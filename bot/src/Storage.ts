import Path from 'node:path';
import { LRU } from 'tiny-lru';
import * as fs from 'node:fs';
import { MiningFrames } from '@argonprotocol/commander-calculator';
import type { IBotStateFile } from './interfaces/IBotStateFile.ts';
import type { IEarningsFile } from './interfaces/IEarningsFile.ts';
import type { IBidsFile } from './interfaces/IBidsFile.ts';
import type { IHistoryFile } from './interfaces/IHistoryFile.ts';
import { JsonStore } from './JsonStore.ts';

export class Storage {
  private lruCache = new LRU<JsonStore<any>>(100);

  constructor(private basedir: string) {
    fs.mkdirSync(this.basedir, { recursive: true });
    fs.mkdirSync(Path.join(this.basedir, 'bot-bids'), { recursive: true });
    fs.mkdirSync(Path.join(this.basedir, 'bot-earnings'), { recursive: true });
    fs.mkdirSync(Path.join(this.basedir, 'bot-history'), { recursive: true });
  }

  public botStateFile(): JsonStore<IBotStateFile> {
    const key = `bot-state.json`;
    let entry = this.lruCache.get(key);
    if (!entry) {
      entry = new JsonStore<IBotStateFile>(Path.join(this.basedir, key), () => ({
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
        currentFrameProgress: 0,
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
    const key = `bot-earnings/frame-${frameId}.json`;
    let entry = this.lruCache.get(key);
    if (!entry) {
      entry = new JsonStore<IEarningsFile>(Path.join(this.basedir, key), () => {
        const tickRange = MiningFrames.getTickRangeForFrameFromSystemTime(frameId);
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
    const key = `bot-bids/frame-${cohortBiddingFrameId}-${cohortActivatingFrameId}.json`;
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
        microgonsToBeMinedPerBlock: 0n,
        winningBids: [],
      }));
      this.lruCache.set(key, entry);
    }
    return entry;
  }

  public historyFile(frameId: number): JsonStore<IHistoryFile> {
    const key = `bot-history/frame-${frameId}.json`;
    let entry = this.lruCache.get(key);
    if (!entry) {
      entry = new JsonStore<IHistoryFile>(Path.join(this.basedir, key), () => {
        return {
          activities: [],
        };
      });
      this.lruCache.set(key, entry);
    }
    return entry;
  }
}
