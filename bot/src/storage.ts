import Path from 'node:path';
import { LRU } from 'tiny-lru';
import * as fs from 'node:fs';
import { JsonExt, type ArgonClient } from '@argonprotocol/mainchain';
import { MiningFrames } from '@argonprotocol/commander-calculator';
import type { IBlockNumbers } from './Dockers.ts';
import { CohortBidder } from '@argonprotocol/mainchain';

export type IBidsHistory = CohortBidder['bidHistory'];

export interface ILastModifiedAt {
  lastModifiedAt?: Date;
}

export interface IEarningsFile extends ILastModifiedAt {
  frameId: number;
  frameProgress: number;
  firstTick: number;
  lastTick: number;
  firstBlockNumber: number;
  lastBlockNumber: number;
  microgonToUsd: bigint[];
  microgonToBtc: bigint[];
  microgonToArgonot: bigint[];
  byCohortActivatingFrameId: {
    [cohortActivatingFrameId: number]: IEarningsFileCohort;
  };
}

export interface IEarningsFileCohort {
  lastBlockMinedAt: string;
  blocksMined: number;
  microgonsMined: bigint;
  microgonsMinted: bigint;
  micronotsMined: bigint;
}

export interface IBidsFile extends ILastModifiedAt {
  cohortBiddingFrameId: number;
  cohortActivatingFrameId: number;
  frameBiddingProgress: number;
  lastBlockNumber: number;
  microgonsBidTotal: bigint;
  transactionFees: bigint;
  micronotsStakedPerSeat: bigint;
  argonotsUsdPrice: number;
  microgonsToBeMinedPerBlock: bigint;
  seatsWon: number;
  winningBids: Array<IWinningBid>;
}

export interface IWinningBid {
  address: string;
  subAccountIndex?: number;
  lastBidAtTick?: number;
  bidPosition?: number;
  microgonsBid?: bigint;
}

export interface ISyncStateStarting {
  isReady: boolean;
  isStarting?: boolean;
  isWaitingForBiddingRules?: boolean;
  isSyncing?: boolean;
  syncProgress: number;
  argonBlockNumbers: IBlockNumbers;
  bitcoinBlockNumbers: IBlockNumbers;
}

export interface ISyncStateError extends ISyncStateStarting {
  serverError: string;
}

export interface ISyncState extends ILastModifiedAt {
  isReady: boolean;
  isStarting?: boolean;
  isWaitingForBiddingRules?: boolean;
  isSyncing?: boolean;
  hasMiningBids: boolean;
  hasMiningSeats: boolean;
  argonBlockNumbers: IBlockNumbers;
  bitcoinBlockNumbers: IBlockNumbers;
  bidsLastModifiedAt: Date;
  earningsLastModifiedAt: Date;
  lastBlockNumber: number;
  lastFinalizedBlockNumber: number;
  oldestFrameIdToSync: number;
  currentFrameId: number;
  syncProgress: number;
  queueDepth: number;
  maxSeatsPossible: number;
  maxSeatsReductionReason: string;
}

export interface ISyncStateFile extends ISyncState {
  lastBlockNumberByFrameId: {
    [frameId: number]: number;
  };
}

async function atomicWrite(path: string, contents: string) {
  const tmp = `${path}.tmp`;
  await fs.promises.writeFile(tmp, contents);
  await fs.promises.rename(tmp, path);
}

export class JsonStore<T extends Record<string, any> & ILastModifiedAt> {
  private data: T | undefined;
  private defaults!: Omit<T, 'lastModified'>;

  constructor(
    private path: string,
    private defaultsFn: () => Omit<T, 'lastModified'> | Promise<Omit<T, 'lastModified'>>,
  ) {}

  public async mutate(mutateFn: (data: T) => boolean | void | Promise<boolean | void>): Promise<boolean> {
    await this.load();
    if (!this.data) {
      this.data = structuredClone(this.defaults) as T;
    }
    const result = await mutateFn(this.data!);
    if (result === false) return false;
    this.data!.lastModifiedAt = new Date();
    // filter non properties
    this.data = Object.fromEntries(Object.entries(this.data!).filter(([key]) => key in this.defaults)) as T;
    await atomicWrite(this.path, JsonExt.stringify(this.data, 2));
    return true;
  }

  public async exists(): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(this.path);
      return stats.isFile();
    } catch (e) {
      return false;
    }
  }

  public async get(): Promise<T | undefined> {
    await this.load();
    return structuredClone(this.data || (this.defaults as T));
  }

  private async load(): Promise<void> {
    this.defaults = await this.defaultsFn();
    if (this.data === undefined) {
      try {
        const data = await fs.promises.readFile(this.path, 'utf-8').then(JsonExt.parse);
        if (data.lastModifiedAt) {
          data.lastModifiedAt = new Date(data.lastModifiedAt);
        }
        this.data = data;
      } catch {}
    }
  }
}

export class CohortStorage {
  constructor(
    private basedir: string,
    private clientPromise: Promise<ArgonClient>,
  ) {
    fs.mkdirSync(this.basedir, { recursive: true });
    fs.mkdirSync(Path.join(this.basedir, 'bids'), { recursive: true });
    fs.mkdirSync(Path.join(this.basedir, 'earnings'), { recursive: true });
  }
  private lruCache = new LRU<JsonStore<any>>(100);

  public syncStateFile(): JsonStore<ISyncStateFile> {
    const key = `sync-state.json`;
    let entry = this.lruCache.get(key);
    if (!entry) {
      entry = new JsonStore<ISyncStateFile>(Path.join(this.basedir, key), () => ({
        isReady: false,
        hasMiningBids: false,
        hasMiningSeats: false,
        argonBlockNumbers: { localNode: 0, mainNode: 0 },
        bitcoinBlockNumbers: { localNode: 0, mainNode: 0 },
        bidsLastModifiedAt: new Date(),
        earningsLastModifiedAt: new Date(),
        lastBlockNumber: 0,
        lastFinalizedBlockNumber: 0,
        oldestFrameIdToSync: 0,
        currentFrameId: 0,
        syncProgress: 0,
        queueDepth: 0,
        maxSeatsPossible: 10, // TODO: instead of hardcoded 10, fetch from chain
        maxSeatsReductionReason: '',
        lastBlockNumberByFrameId: {},
      }));
      this.lruCache.set(key, entry);
    }
    return entry;
  }

  /**
   * @param frameId - the frame id of the last block mined
   */
  public earningsFile(frameId: number): JsonStore<IEarningsFile> {
    const key = `earnings/frame-${frameId}.json`;
    let entry = this.lruCache.get(key);
    if (!entry) {
      entry = new JsonStore<IEarningsFile>(Path.join(this.basedir, key), async () => {
        const client = await this.clientPromise;
        const tickRange = await new MiningFrames().getTickRangeForFrame(client, frameId);
        return {
          frameId,
          frameProgress: 0,
          firstTick: tickRange[0],
          lastTick: tickRange[1],
          firstBlockNumber: 0,
          lastBlockNumber: 0,
          microgonToUsd: [],
          microgonToBtc: [],
          microgonToArgonot: [],
          byCohortActivatingFrameId: {},
        };
      });
      this.lruCache.set(key, entry);
    }
    return entry;
  }

  public bidsFile(cohortActivatingFrameId: number): JsonStore<IBidsFile> {
    const cohortBiddingFrameId = cohortActivatingFrameId - 1;
    const key = `bids/frame-${cohortBiddingFrameId}-${cohortActivatingFrameId}.json`;
    let entry = this.lruCache.get(key);
    if (!entry) {
      entry = new JsonStore<IBidsFile>(Path.join(this.basedir, key), () => ({
        cohortBiddingFrameId,
        cohortActivatingFrameId: cohortActivatingFrameId,
        frameBiddingProgress: 0,
        lastBlockNumber: 0,
        seatsWon: 0,
        microgonsBidTotal: 0n,
        transactionFees: 0n,
        micronotsStakedPerSeat: 0n,
        argonotsUsdPrice: 0,
        microgonsToBeMinedPerBlock: 0n,
        winningBids: [],
      }));
      this.lruCache.set(key, entry);
    }
    return entry;
  }
}
