import {
  AccountMiners,
  type Accountset,
  type ArgonClient,
  FrameCalculator,
  type FrameSystemEventRecord,
  type GenericEvent,
  getAuthorFromHeader,
  getTickFromHeader,
  type Header,
  type SpRuntimeDispatchError,
  type Vec,
} from '@argonprotocol/mainchain';
import { type Storage } from './Storage.ts';
import type { IBotState, IBotStateFile } from './interfaces/IBotStateFile.ts';
import type { IWinningBid } from './interfaces/IBidsFile.ts';
import { JsonStore } from './JsonStore.ts';
import { Mainchain, MiningFrames } from '@argonprotocol/commander-calculator';
import { Dockers } from './Dockers.ts';
import type Bot from './Bot.ts';
import type { AutoBidder } from './AutoBidder.ts';
import { CohortBidder } from './CohortBidder.ts';

const defaultCohort = {
  blocksMined: 0,
  micronotsMined: 0n,
  microgonsMined: 0n,
  microgonsMinted: 0n,
  lastBlockMinedAt: '',
};

export interface ILastProcessed {
  date: Date;
  frameId: number;
  blockNumber: number;
}

export class BlockSync {
  queue: Header[] = [];
  lastProcessed?: ILastProcessed;
  accountMiners!: AccountMiners;
  latestFinalizedHeader!: Header;
  scheduleTimer?: NodeJS.Timeout;
  botStateFile: JsonStore<IBotStateFile>;

  currentFrameTickRange: [number, number] = [0, 0];

  oldestTick: number = 0;
  latestTick: number = 0;
  earliestQueuedTick: number = 0;
  currentTick: number = 0;

  didProcessFinalizedBlock?: (lastProcessed: ILastProcessed) => void;

  private unsubscribe?: () => void;
  private previousNextCohortJson?: string;
  private isStopping: boolean = false;
  private mainchain!: Mainchain;
  private lastExchangeRateDate?: Date;
  private lastExchangeRateFrameId?: number;
  private tickDurationMillis: number = 60000; // 1 minute in milliseconds

  constructor(
    public bot: Bot,
    public autobidder: AutoBidder,
    public accountset: Accountset,
    public storage: Storage,
    public localClient: ArgonClient,
    public archiveClient: ArgonClient,
    private oldestFrameIdToSync?: number,
  ) {
    this.scheduleNext = this.scheduleNext.bind(this);
    this.botStateFile = this.storage.botStateFile();
  }

  async load() {
    this.isStopping = false;
    this.localClient = await this.accountset.client;
    this.mainchain = new Mainchain(this.accountset.client);

    const finalizedHash = await this.localClient.rpc.chain.getFinalizedHead();
    this.latestFinalizedHeader = await this.localClient.rpc.chain.getHeader(finalizedHash);
    this.latestTick = getTickFromHeader(this.localClient, this.latestFinalizedHeader) ?? 0;
    this.tickDurationMillis = (await this.localClient.query.ticks.genesisTicker()).tickDurationMillis.toNumber();
    this.earliestQueuedTick = this.latestTick;
    await this.setOldestFrameIdIfNeeded();

    const botStateData = (await this.botStateFile.get())!;
    const oldestTickRange = await MiningFrames.getTickRangeForFrame(this.localClient, botStateData.oldestFrameIdToSync);
    this.oldestTick = oldestTickRange[0];

    // plug any gaps in the sync state
    let header = this.latestFinalizedHeader;
    let headerBlockNumber = header.number.toNumber();
    let headerFrameId = await this.getFrameIdFromHeader(header);

    while (headerBlockNumber > botStateData.lastBlockNumber + 1 && headerFrameId >= botStateData.oldestFrameIdToSync) {
      console.log(`Queuing frame ${headerFrameId} block ${headerBlockNumber}`);
      this.queue.unshift(header);
      this.earliestQueuedTick = getTickFromHeader(this.localClient, header) ?? this.earliestQueuedTick;
      header = await this.getParentHeader(header);
      headerBlockNumber = header.number.toNumber();
      headerFrameId = await this.getFrameIdFromHeader(header);
    }

    console.log('Sync starting', {
      ...botStateData,
      queue: `${this.queue.at(0)?.number.toNumber()}..${this.queue.at(-1)?.number.toNumber()}`,
    });

    const loadAt = this.queue.at(0) ?? this.latestFinalizedHeader;
    const api = await this.getRpcClient(loadAt).at(loadAt.hash);
    const startingMinerState = await this.accountset.loadRegisteredMiners(api);
    const registeredMiners = startingMinerState
      .filter(x => x.seat !== undefined)
      .map((x: any) => ({
        ...x,
        startingFrameId: x.seat.frameId,
      }));

    this.accountMiners = new AccountMiners(this.accountset, registeredMiners);

    // catchup now
    while (this.queue.length) {
      const header = this.queue.shift()!;
      await this.processHeader(header);
    }
  }

  async start() {
    this.unsubscribe = await this.localClient.rpc.chain.subscribeFinalizedHeads(header => {
      if (this.latestFinalizedHeader.hash === header.hash) {
        return;
      }
      this.latestFinalizedHeader = header;
      this.queue.push(header);
      this.queue.sort((a, b) => a.number.toNumber() - b.number.toNumber());
    });

    await this.scheduleNext();
  }

  async state(): Promise<IBotState> {
    const botStateData = (await this.botStateFile.get())!;
    const [argonBlockNumbers, bitcoinBlockNumbers] = await Promise.all([
      Dockers.getArgonBlockNumbers(),
      Dockers.getBitcoinBlockNumbers(),
    ]);
    return {
      isReady: this.bot.isReady || false,
      isStarting: this.bot.isStarting || undefined,
      isSyncing: this.bot.isSyncing || undefined,
      hasMiningBids: botStateData.hasMiningBids ?? false,
      hasMiningSeats: botStateData.hasMiningSeats ?? false,
      argonBlockNumbers,
      bitcoinBlockNumbers,
      bidsLastModifiedAt: botStateData.bidsLastModifiedAt,
      earningsLastModifiedAt: botStateData.earningsLastModifiedAt,
      lastBlockNumber: botStateData.lastBlockNumber ?? 0,
      lastFinalizedBlockNumber: this.latestFinalizedHeader?.number.toNumber() ?? 0,
      oldestFrameIdToSync: botStateData.oldestFrameIdToSync ?? 0,
      currentFrameId: botStateData.currentFrameId ?? 0,
      currentFrameProgress: this.calculateProgress(this.currentTick, this.currentFrameTickRange),
      syncProgress: await this.calculateSyncProgress(),
      queueDepth: this.queue.length,
      maxSeatsPossible: this.bot.history.maxSeatsInPlay ?? 10, // TODO: instead of hardcoded 10, fetch from chain
      maxSeatsReductionReason: this.bot.history.maxSeatsReductionReason ?? '',
    };
  }

  async calculateSyncProgress(): Promise<number> {
    const processingProgress = this.calculateProgress(this.currentTick, [this.oldestTick, this.latestTick]);

    let queueProgress = 100;
    if (processingProgress === 0) {
      const ticksQueued = this.latestTick - this.earliestQueuedTick;
      queueProgress = this.calculateProgress(this.oldestTick + ticksQueued, [this.oldestTick, this.latestTick]);
    }

    const progress = (queueProgress + processingProgress) / 2;
    return Math.round(progress * 100) / 100;
  }

  async stop() {
    if (this.isStopping) return;
    this.isStopping = true;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    if (this.scheduleTimer) {
      clearTimeout(this.scheduleTimer);
      this.scheduleTimer = undefined;
    }
    await this.archiveClient.disconnect();
    // local client is not owned by this service
  }

  async scheduleNext() {
    if (this.scheduleTimer) clearTimeout(this.scheduleTimer);
    let waitTime = 500;
    if (this.queue.length) {
      // plug any gaps in the sync state
      const botStateData = (await this.botStateFile.get())!;
      let first = this.queue.at(0)!;
      while (first.number.toNumber() > botStateData.lastBlockNumber + 1) {
        first = await this.getParentHeader(first);
        this.queue.unshift(first);
      }

      // now process the next header
      const header = this.queue.shift()!;
      try {
        await this.processHeader(header);
      } catch (e) {
        console.error(`Error processing block ${header.number.toNumber()} header`, e);
        if (this.isStopping) return;
        throw e;
      }
      if (this.queue.length) waitTime = 0;
    }
    this.scheduleTimer = setTimeout(this.scheduleNext, waitTime);
  }

  async processHeader(header: Header) {
    const author = getAuthorFromHeader(this.localClient, header);
    const tick = getTickFromHeader(this.localClient, header);
    const currentFrameId = await this.getFrameIdFromHeader(header);

    if (!tick || !author) {
      console.warn('No tick or author found for header', header.number.toNumber());
      return;
    }

    const client = this.getRpcClient(header);
    const api = await client.at(header.hash);
    const events = await api.query.system.events();
    const { duringFrameId: _r, ...cohortEarningsAtFrameId } = await this.accountMiners.onBlock(
      header,
      { tick, author },
      events.map(x => x.event),
    );
    const tickDate = new Date(tick * this.tickDurationMillis);

    if (this.lastProcessed?.frameId !== currentFrameId) {
      this.currentFrameTickRange = await MiningFrames.getTickRangeForFrame(this.localClient, currentFrameId);
    }

    const didChangeBiddings = await this.syncBidding(header, events);
    await this.storage.earningsFile(currentFrameId).mutate(async x => {
      if (x.lastBlockNumber >= header.number.toNumber()) {
        console.warn('Already processed block', {
          lastBlockNumber: x.lastBlockNumber,
          blockNumber: header.number.toNumber(),
        });
        return false;
      }
      x.frameProgress = this.calculateProgress(tick, this.currentFrameTickRange);
      const blockNumber = header.number.toNumber();
      x.firstBlockNumber = x.firstBlockNumber === 0 ? blockNumber : x.firstBlockNumber;
      x.lastBlockNumber = blockNumber;

      const secondsSinceLastExchangeRate = this.lastExchangeRateDate
        ? (new Date().getTime() - this.lastExchangeRateDate.getTime()) / 1000
        : null;
      const checkedExchangeRateThisHour = secondsSinceLastExchangeRate !== null && secondsSinceLastExchangeRate < 3600;
      const checkedExchangeRateThisFrame = this.lastExchangeRateFrameId === currentFrameId;

      if (!checkedExchangeRateThisFrame || !checkedExchangeRateThisHour) {
        this.lastExchangeRateDate = new Date();
        this.lastExchangeRateFrameId = currentFrameId;
        const microgonExchangeRateTo = await this.mainchain.fetchMicrogonExchangeRatesTo();
        x.microgonToUsd.push(microgonExchangeRateTo.USD);
        x.microgonToBtc.push(microgonExchangeRateTo.BTC);
        x.microgonToArgonot.push(microgonExchangeRateTo.ARGNOT);
      }

      for (const [cohortActivatingFrameIdStr, earnings] of Object.entries(cohortEarningsAtFrameId)) {
        const cohortActivatingFrameId = Number(cohortActivatingFrameIdStr);
        const { argonsMinted: microgonsMinted, argonotsMined: micronotsMined, argonsMined: microgonsMined } = earnings;
        x.byCohortActivatingFrameId[cohortActivatingFrameId] ??= structuredClone(defaultCohort);
        x.byCohortActivatingFrameId[cohortActivatingFrameId].micronotsMined += micronotsMined;
        x.byCohortActivatingFrameId[cohortActivatingFrameId].microgonsMined += microgonsMined;
        x.byCohortActivatingFrameId[cohortActivatingFrameId].microgonsMinted += microgonsMinted;
        if (microgonsMined > 0n) {
          x.byCohortActivatingFrameId[cohortActivatingFrameId].blocksMined += 1;
          x.byCohortActivatingFrameId[cohortActivatingFrameId].lastBlockMinedAt = tickDate.toString();
        }
      }

      console.log('Processed finalized block', {
        currentFrameId,
        blockNumber: header.number.toNumber(),
      });
    });

    this.currentTick = tick ?? 0;
    if (this.latestTick < this.currentTick) {
      this.latestTick = this.currentTick;
    }
    this.lastProcessed = {
      date: new Date(),
      frameId: currentFrameId,
      blockNumber: header.number.toNumber(),
    };

    await this.botStateFile.mutate(x => {
      if (x.lastBlockNumber >= header.number.toNumber()) {
        return false;
      }
      if (didChangeBiddings) x.bidsLastModifiedAt = new Date();
      x.earningsLastModifiedAt = new Date();
      x.lastBlockNumber = header.number.toNumber();
      x.currentFrameId = currentFrameId;
      x.currentFrameProgress = this.calculateProgress(this.currentTick, this.currentFrameTickRange);
      x.syncProgress = this.calculateProgress(this.currentTick, [this.oldestTick, this.latestTick]);
      x.queueDepth = this.queue.length;
      x.lastBlockNumberByFrameId[currentFrameId] = header.number.toNumber();
    });

    this.didProcessFinalizedBlock?.(this.lastProcessed);
  }

  /**
   * Gets an appropriate client for this header. The local node will be pruned to 256 finalized blocks.
   * @param headerOrNumber
   */
  private getRpcClient(headerOrNumber: Header | number): ArgonClient {
    let headerNumber = typeof headerOrNumber === 'number' ? headerOrNumber : headerOrNumber.number.toNumber();
    // TODO: this is currently broken when using fast sync, so setting to 0
    const SYNCHED_STATE_DEPTH = 0;
    if (headerNumber < this.latestFinalizedHeader.number.toNumber() - SYNCHED_STATE_DEPTH) {
      return this.archiveClient;
    }
    return this.localClient;
  }

  private async setOldestFrameIdIfNeeded() {
    const botStateData = await this.botStateFile.get();
    if (botStateData && botStateData.oldestFrameIdToSync > 0) return;
    const oldestFrameIdToSync =
      this.oldestFrameIdToSync ?? (await this.getFrameIdFromHeader(this.latestFinalizedHeader));
    await this.botStateFile.mutate(x => {
      x.oldestFrameIdToSync = oldestFrameIdToSync;
      x.syncProgress = this.calculateProgress(this.currentTick, [this.oldestTick, this.latestTick]);
    });
  }

  private async getParentHeader(header: Header): Promise<Header> {
    return this.getRpcClient(header).rpc.chain.getHeader(header.parentHash);
  }

  private async getFrameIdFromHeader(header: Header): Promise<number> {
    const currentFrameId = await new FrameCalculator().getForHeader(this.localClient, header);
    if (currentFrameId === undefined) {
      throw new Error(`Error getting frame id for header ${header.number.toNumber()}`);
    }
    return currentFrameId;
  }

  private async syncBidding(header: Header, events: Vec<FrameSystemEventRecord>): Promise<boolean> {
    const client = this.getRpcClient(header);
    const api = await client.at(header.hash);
    const headerTick = getTickFromHeader(client, header);

    const blockNumber = header.number.toNumber();
    const cohortActivatingFrameId = await api.query.miningSlot.nextFrameId().then(x => x.toNumber());
    const bidsFile = this.storage.bidsFile(cohortActivatingFrameId);
    const nextCohort = await api.query.miningSlot.bidsForNextSlotCohort();

    let didChangeBiddings = false;
    if (this.previousNextCohortJson !== nextCohort.toJSON()) {
      this.previousNextCohortJson = JSON.stringify(nextCohort.toJSON());
      let hasMiningBids = false;
      didChangeBiddings = await bidsFile.mutate(async x => {
        if (x.lastBlockNumber >= blockNumber) {
          console.warn('Already processed block', {
            lastStored: x.lastBlockNumber,
            blockNumber: blockNumber,
          });
          return false;
        }
        if (!x.microgonsToBeMinedPerBlock) {
          const data = await CohortBidder.getStartingData(api as any);
          x.micronotsStakedPerSeat = data.micronotsStakedPerSeat;
          x.microgonsToBeMinedPerBlock = data.microgonsToBeMinedPerBlock;
        }
        x.frameBiddingProgress = this.calculateProgress(headerTick, this.currentFrameTickRange);
        x.lastBlockNumber = blockNumber;
        x.winningBids = nextCohort.map((c, i): IWinningBid => {
          const address = c.accountId.toHuman();
          const microgonsBid = c.bid.toBigInt();
          const ourSubAccount = this.accountset.subAccountsByAddress[address];
          if (ourSubAccount) {
            hasMiningBids = true;
          }
          return {
            address,
            subAccountIndex: ourSubAccount?.index,
            lastBidAtTick: c.bidAtTick?.toNumber(),
            bidPosition: i,
            microgonsBid,
          };
        });
      });
      if (hasMiningBids) {
        await this.botStateFile.mutate(x => {
          x.bidsLastModifiedAt = new Date();
          x.hasMiningBids = true;
        });
      }
    }

    for (const { event, phase } of events) {
      if (phase.isApplyExtrinsic) {
        const extrinsicIndex = phase.asApplyExtrinsic.toNumber();
        const extrinsicEvents = events.filter(
          x => x.phase.isApplyExtrinsic && x.phase.asApplyExtrinsic.toNumber() === extrinsicIndex,
        );
        const transactionFee = await this.extractTransactionFee(client, event, extrinsicEvents);
        if (transactionFee > 0n) {
          const blockNumber = header.number.toNumber();
          didChangeBiddings ||= await bidsFile.mutate(x => {
            if (x.lastBlockNumber >= blockNumber) {
              console.warn('Already processed cohort block', {
                lastStored: x.lastBlockNumber,
                blockNumber: blockNumber,
              });
              return false;
            }
            x.transactionFees += transactionFee;
          });
        }
      }

      if (phase.isFinalization && client.events.miningSlot.NewMiners.is(event)) {
        console.log('New miners event', event.data.toJSON());
        let hasMiningSeats = false;
        const { frameId, newMiners } = event.data;
        await this.storage.bidsFile(frameId.toNumber()).mutate(x => {
          x.seatsWon = 0;
          x.microgonsBidTotal = 0n;
          x.winningBids = [];
          x.lastBlockNumber = blockNumber;

          let bidPosition = 0;
          for (const miner of newMiners) {
            const address = miner.accountId.toHuman();
            const microgonsBid = miner.bid.toBigInt();
            const ourSubAccount = this.accountset.subAccountsByAddress[address];
            if (ourSubAccount) {
              hasMiningSeats = true;
              x.seatsWon += 1;
              x.microgonsBidTotal += microgonsBid;
            }
            x.winningBids.push({
              address,
              subAccountIndex: ourSubAccount?.index,
              lastBidAtTick: miner.bidAtTick?.toNumber(),
              bidPosition,
              microgonsBid,
            });
            bidPosition++;
          }
        });
        await this.botStateFile.mutate(x => {
          x.bidsLastModifiedAt = new Date();
          x.syncProgress = this.calculateProgress(this.currentTick, [this.oldestTick, this.latestTick]);
          if (hasMiningSeats) {
            x.hasMiningBids = true;
            x.hasMiningSeats = true;
          }
        });
      }
    }

    return didChangeBiddings;
  }

  private async extractTransactionFee(
    client: ArgonClient,
    event: GenericEvent,
    extrinsicEvents: FrameSystemEventRecord[],
  ) {
    if (!client.events.transactionPayment.TransactionFeePaid.is(event)) {
      return 0n;
    }

    const [account, fee] = event.data;
    if (account.toHuman() !== this.accountset.txSubmitterPair.address) {
      return 0n;
    }
    const isMiningTx = extrinsicEvents.some(x => {
      let dispatchError: SpRuntimeDispatchError | undefined;
      if (client.events.utility.BatchInterrupted.is(x.event)) {
        const [_index, error] = x.event.data;
        dispatchError = error;
      }
      if (client.events.system.ExtrinsicFailed.is(x.event)) {
        dispatchError = x.event.data[0];
      }
      if (dispatchError && dispatchError.isModule) {
        const decoded = client.registry.findMetaError(dispatchError.asModule);
        if (decoded.section === 'miningSlot') {
          return true;
        }
      }
      if (client.events.miningSlot.SlotBidderAdded.is(x.event)) {
        return true;
      }
    });
    if (isMiningTx) {
      return fee.toBigInt();
    }
    return 0n;
  }

  private calculateProgress(tick: number | undefined, tickRange: [number, number] | undefined): number {
    if (!tick || !tickRange) return 0;
    const progress = tick ? (tick - tickRange[0]) / (tickRange[1] - tickRange[0]) : 0;
    return Math.round(progress * 10000) / 100;
  }
}
