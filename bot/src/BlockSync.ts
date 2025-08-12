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
import type { IBotState, IBotStateFile, IBotSyncStatus } from './interfaces/IBotStateFile.ts';
import type { IWinningBid } from './interfaces/IBidsFile.ts';
import { JsonStore } from './JsonStore.ts';
import { Mainchain, MiningFrames } from '@argonprotocol/commander-calculator';
import { Dockers } from './Dockers.ts';
import type { IBlock, IBlockSyncFile } from './interfaces/IBlockSyncFile.js';

export interface ILastProcessed {
  date: Date;
  frameId: number;
  blockNumber: number;
}

export class BlockSync {
  lastProcessed?: ILastProcessed;
  accountMiners!: AccountMiners;
  latestFinalizedBlockNumber!: number;
  scheduleTimer?: NodeJS.Timeout;
  botStateFile: JsonStore<IBotStateFile>;
  blockSyncFile: JsonStore<IBlockSyncFile>;
  inProcessSync?: ReturnType<BlockSync['processNext']>;

  currentFrameTickRange: [number, number] = [0, 0];

  oldestTick: number = 0;
  latestTick: number = 0;
  earliestQueuedTick: number = 0;
  currentTick: number = 0;

  didProcessFinalizedBlock?: (lastProcessed: ILastProcessed) => void;

  private unsubscribe?: () => void;
  private isStopping: boolean = false;
  private mainchain!: Mainchain;
  private lastExchangeRateDate?: Date;
  private lastExchangeRateFrameId?: number;
  private tickDurationMillis: number = 60000; // 1 minute in milliseconds
  private frameCalculator = new FrameCalculator();

  constructor(
    public bot: IBotSyncStatus,
    public accountset: Accountset,
    public storage: Storage,
    public localClient: ArgonClient,
    public archiveClient: ArgonClient,
    private oldestFrameIdToSync?: number,
  ) {
    this.scheduleNext = this.scheduleNext.bind(this);
    this.botStateFile = this.storage.botStateFile();
    this.blockSyncFile = this.storage.botBlockSyncFile();
    this.mainchain = new Mainchain(this.accountset.client);
  }

  async load() {
    this.isStopping = false;
    this.localClient = await this.accountset.client;

    const finalizedHash = await this.localClient.rpc.chain.getFinalizedHead();
    const finalizedHeader = await this.localClient.rpc.chain.getHeader(finalizedHash);
    this.latestFinalizedBlockNumber = finalizedHeader.number.toNumber();
    await this.setOldestFrameIdIfNeeded(finalizedHeader);

    this.latestTick = await this.localClient.query.ticks.currentTick().then(x => x.toNumber());
    this.tickDurationMillis = (await this.localClient.query.ticks.genesisTicker()).tickDurationMillis.toNumber();
    this.earliestQueuedTick = this.latestTick;

    const botStateData = (await this.botStateFile.get())!;
    const oldestTickRange = await MiningFrames.getTickRangeForFrame(this.localClient, botStateData.oldestFrameIdToSync);
    this.oldestFrameIdToSync = botStateData.oldestFrameIdToSync;
    this.oldestTick = oldestTickRange[0];

    console.log('Sync starting', {
      ...botStateData,
    });

    const startingMinerState = await this.accountset.loadRegisteredMiners(this.localClient);
    const registeredMiners = startingMinerState
      .filter(x => x.seat !== undefined)
      .map((x: any) => ({
        ...x,
        startingFrameId: x.seat.frameId,
      }));

    this.accountMiners = new AccountMiners(this.accountset, registeredMiners);
    await this.backfillBestBlockHeader(await this.localClient.rpc.chain.getHeader());
    const data = (await this.blockSyncFile.get())!;
    console.log('After initial sync state', {
      ...data,
    });

    // catchup now
    await this.syncToLatest();
  }

  async backfillBestBlockHeader(header: Header): Promise<IBlockSyncFile | undefined> {
    if (this.isStopping) return;
    // plug any gaps in the sync state
    let final: IBlockSyncFile | undefined;
    await this.blockSyncFile.mutate(async x => {
      x.finalizedBlockNumber = this.latestFinalizedBlockNumber;
      x.bestBlockNumber = header.number.toNumber();

      while (header != null) {
        const blockHash = header.hash.toHex();
        const blockNumber = header.number.toNumber();
        if (blockNumber == 0) {
          break;
        }
        const headerFrameId = await this.getFrameIdFromHeader(header);

        if (x.blocksByNumber[blockNumber]?.hash === blockHash || headerFrameId < this.oldestFrameIdToSync!) {
          break;
        }
        console.log(`Queuing block to sync. Block: ${blockNumber}, Frame ID: ${headerFrameId}, Hash: ${blockHash}`);
        // set synced back if we are syncing to a block that is older than the current synced block
        if (x.syncedToBlockNumber >= blockNumber) {
          x.syncedToBlockNumber = blockNumber - 1;
        }

        const tick = getTickFromHeader(this.localClient, header)!;
        const author = getAuthorFromHeader(this.localClient, header)!;
        x.blocksByNumber[blockNumber] = {
          hash: blockHash,
          tick,
          number: blockNumber,
          author,
        };
        this.earliestQueuedTick = Math.min(tick, this.earliestQueuedTick);
        // don't go back to genesis
        if (blockNumber === 1) {
          break;
        }
        try {
          header = await this.getRpcClient(header).rpc.chain.getHeader(header.parentHash);
        } catch (e) {
          console.error(`Error getting parent header for ${blockNumber}`, e);
          break; // stop if we can't get the parent header
        }
      }

      const blockKeys = Object.keys(x.blocksByNumber).map(Number);
      let oldestToKeep = Math.min(x.syncedToBlockNumber, x.finalizedBlockNumber);
      oldestToKeep -= 5; // keep some overflow
      const minBlock = Math.min(...blockKeys);
      for (const key of blockKeys) {
        if (key < oldestToKeep) {
          delete x.blocksByNumber[key];
        }
      }
      if (x.syncedToBlockNumber < minBlock - 1) {
        x.syncedToBlockNumber = minBlock - 1;
      }
      final = x;
    });
    return final;
  }

  async start() {
    const unsub1 = await this.localClient.rpc.chain.subscribeNewHeads(header => {
      this.backfillBestBlockHeader(header);
    });
    const unsub2 = await this.localClient.rpc.chain.subscribeFinalizedHeads(header => {
      this.latestFinalizedBlockNumber = header.number.toNumber();
    });
    this.unsubscribe = () => {
      unsub1();
      unsub2();
    };

    await this.scheduleNext();
  }

  async stop() {
    if (this.isStopping) return;
    console.log('BLOCKSYNC STOPPING');
    this.isStopping = true;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    if (this.scheduleTimer) {
      clearTimeout(this.scheduleTimer);
      this.scheduleTimer = undefined;
    }
    await this.inProcessSync;
    this.inProcessSync = undefined;
    await this.archiveClient.disconnect();
    console.log('BLOCKSYNC STOPPED');
    // local client is not owned by this service
  }

  async state(): Promise<IBotState> {
    const [argonBlockNumbers, bitcoinBlockNumbers, botStateData, blockSyncData] = await Promise.all([
      Dockers.getArgonBlockNumbers(),
      Dockers.getBitcoinBlockNumbers(),
      this.botStateFile.get(),
      this.blockSyncFile.get(),
    ]);
    const { syncedToBlockNumber, bestBlockNumber, finalizedBlockNumber } = blockSyncData!;
    return {
      ...botStateData!,
      isReady: this.bot.isReady || false,
      isStarting: this.bot.isStarting || undefined,
      isSyncing: this.bot.isSyncing || undefined,
      lastBlockNumber: bestBlockNumber,
      lastFinalizedBlockNumber: finalizedBlockNumber,
      syncedToBlockNumber,
      argonBlockNumbers,
      bitcoinBlockNumbers,
      queueDepth: bestBlockNumber - syncedToBlockNumber,
      maxSeatsPossible: this.bot.maxSeatsInPlay ?? 10, // TODO: instead of hardcoded 10, fetch from chain
      maxSeatsReductionReason: this.bot.maxSeatsReductionReason ?? '',
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

  async syncToLatest() {
    while (true) {
      const result = await this.processNext();
      if (!result) {
        break;
      }
    }
    console.log('Synched to latest');
  }

  async scheduleNext(waitTime: number = 500): Promise<void> {
    if (this.scheduleTimer) clearTimeout(this.scheduleTimer);
    if (this.isStopping) return;

    try {
      this.inProcessSync = this.processNext();
      const result = await this.inProcessSync;
      if (result?.remaining ?? 0 > 0) {
        waitTime = 0;
      }
    } catch (e) {
      console.error(`Error processing next header`, e);
      if (this.isStopping) return;
      throw e;
    }
    this.scheduleTimer = setTimeout(this.scheduleNext, waitTime);
  }

  async processNext(): Promise<{ processed: IBlock; remaining: number } | undefined> {
    const blockSyncData = (await this.blockSyncFile.get())!;
    const bestBlockNumber = blockSyncData.bestBlockNumber;
    const syncedToBlockNumber = blockSyncData.syncedToBlockNumber;
    if (syncedToBlockNumber >= bestBlockNumber) {
      return undefined;
    }

    const blockNumber = syncedToBlockNumber + 1;
    const blockMeta = blockSyncData.blocksByNumber[blockNumber]!;

    console.log('Processing block', blockMeta);

    const client = this.getRpcClient(blockNumber);
    const api = await client.at(blockMeta.hash);
    const events = await api.query.system.events();
    const { duringFrameId: _r, ...cohortEarningsAtFrameId } = await this.accountMiners.onBlock(
      null as any,
      blockMeta,
      events.map(x => x.event),
    );
    const tick = blockMeta.tick;
    const tickDate = new Date(tick * this.tickDurationMillis);

    const currentFrameId = await this.frameCalculator.getForTick(this.localClient, tick);
    if (this.lastProcessed?.frameId !== currentFrameId) {
      this.currentFrameTickRange = await MiningFrames.getTickRangeForFrame(this.localClient, currentFrameId);
    }

    const { hasMiningBids, hasMiningSeats } = await this.syncBidding(currentFrameId, blockMeta, events);
    await this.storage.earningsFile(currentFrameId).mutate(async x => {
      x.frameProgress = this.calculateProgress(tick, this.currentFrameTickRange);
      x.firstBlockNumber ||= blockNumber;
      x.lastBlockNumber = blockNumber;

      const secondsSinceLastExchangeRate = this.lastExchangeRateDate
        ? (new Date().getTime() - this.lastExchangeRateDate.getTime()) / 1000
        : null;
      const checkedExchangeRateThisHour = secondsSinceLastExchangeRate !== null && secondsSinceLastExchangeRate < 3600;
      const checkedExchangeRateThisFrame = this.lastExchangeRateFrameId === currentFrameId;

      if (!checkedExchangeRateThisFrame || !checkedExchangeRateThisHour) {
        this.lastExchangeRateDate = new Date();
        this.lastExchangeRateFrameId = currentFrameId;
        const microgonExchangeRateTo = await this.mainchain.fetchMicrogonExchangeRatesTo(blockMeta.hash);
        x.microgonToUsd.push(microgonExchangeRateTo.USD);
        x.microgonToBtc.push(microgonExchangeRateTo.BTC);
        x.microgonToArgonot.push(microgonExchangeRateTo.ARGNOT);
      }

      // there can only be one mining cohort that mines a block, so we can safely use the first one
      const miningCohortActivationFrameId = Object.keys(cohortEarningsAtFrameId)[0];
      if (miningCohortActivationFrameId) {
        const {
          argonsMinted: microgonsMinted,
          argonsMined: microgonsMined,
          argonotsMined: micronotsMined,
        } = cohortEarningsAtFrameId[miningCohortActivationFrameId as any];
        const blockFees = await this.mainchain.fetchMicrogonBlockFeesMined(blockMeta.hash);
        x.earningsByBlock[blockNumber] = {
          blockHash: blockMeta.hash,
          authorCohortActivationFrameId: Number(miningCohortActivationFrameId),
          authorAddress: blockMeta.author,
          blockMinedAt: tickDate.toString(),
          microgonFeesMined: blockFees,
          micronotsMined,
          microgonsMined,
          microgonsMinted,
        };
      } else {
        // there's a chance we've re-orged and the block is not a mining block anymore, so clear it
        delete x.earningsByBlock[blockNumber];
      }
    });

    this.currentTick = tick ?? 0;
    if (this.latestTick < this.currentTick) {
      this.latestTick = this.currentTick;
    }
    this.lastProcessed = {
      date: new Date(),
      frameId: currentFrameId,
      blockNumber,
    };

    await this.blockSyncFile.mutate(x => {
      x.syncedToBlockNumber = blockNumber;
    });

    await this.botStateFile.mutate(x => {
      if (hasMiningBids) x.bidsLastModifiedAt = new Date();
      if (hasMiningSeats) x.hasMiningSeats = true;
      x.earningsLastModifiedAt = new Date();
      x.currentFrameId = currentFrameId;
      x.currentFrameProgress = this.calculateProgress(this.currentTick, this.currentFrameTickRange);
      x.syncProgress = this.calculateProgress(this.currentTick, [this.oldestTick, this.latestTick]);
      x.lastBlockNumberByFrameId[currentFrameId] = blockNumber;
    });

    this.didProcessFinalizedBlock?.(this.lastProcessed);
    const remaining = bestBlockNumber - blockNumber;
    console.log(
      `Processed block ${blockNumber} at tick ${tick}. Progress: ${((blockNumber * 100) / bestBlockNumber).toFixed(1)}%`,
    );
    return {
      processed: blockMeta,
      remaining,
    };
  }

  private async syncBidding(
    cohortBiddingFrameId: number,
    block: IBlock,
    events: Vec<FrameSystemEventRecord>,
  ): Promise<{ hasMiningBids: boolean; hasMiningSeats: boolean }> {
    const client = this.getRpcClient(block.number);
    const api = await client.at(block.hash);
    const headerTick = block.tick;

    const blockNumber = block.number;

    let biddingTransactionFees = 0n;
    let hasMiningBids = false;
    let hasMiningSeats = false;

    for (const { event, phase } of events) {
      if (phase.isApplyExtrinsic) {
        const extrinsicIndex = phase.asApplyExtrinsic.toNumber();
        const extrinsicEvents = events.filter(
          x => x.phase.isApplyExtrinsic && x.phase.asApplyExtrinsic.toNumber() === extrinsicIndex,
        );
        biddingTransactionFees += await this.extractOwnPaidTransactionFee(client, event, extrinsicEvents);
      }

      if (phase.isFinalization && client.events.miningSlot.NewMiners.is(event)) {
        console.log('New miners event', event.data.toJSON());
        const { frameId, newMiners } = event.data;
        const activationFrameIdOfNewCohort = frameId.toNumber();
        const biddingFrameIdOfNewCohort = activationFrameIdOfNewCohort - 1;
        const lastBidsFile = this.storage.bidsFile(biddingFrameIdOfNewCohort, activationFrameIdOfNewCohort);
        await lastBidsFile.mutate(x => {
          x.seatsWon = 0;
          x.microgonsBidTotal = 0n;
          x.winningBids = [];
          x.frameBiddingProgress = 100;
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
      }
    }

    const cohortActivationFrameId = await api.query.miningSlot.nextFrameId().then(x => x.toNumber());
    const bidsFile = this.storage.bidsFile(cohortBiddingFrameId, cohortActivationFrameId);
    const nextCohort = await api.query.miningSlot.bidsForNextSlotCohort();
    await bidsFile.mutate(async x => {
      x.micronotsStakedPerSeat ||= await api.query.miningSlot.argonotsPerMiningSeat().then(x => x.toBigInt());
      x.microgonsToBeMinedPerBlock ||= await api.query.blockRewards.argonsPerBlock().then(x => x.toBigInt());
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
      if (biddingTransactionFees > 0n) {
        x.transactionFeesByBlock[blockNumber] = biddingTransactionFees;
      } else {
        delete x.transactionFeesByBlock[blockNumber];
      }
    });
    return { hasMiningBids, hasMiningSeats };
  }

  /**
   * Gets an appropriate client for this header. The local node will be pruned to 256 finalized blocks.
   * @param headerOrNumber
   */
  private getRpcClient(headerOrNumber: Header | number): ArgonClient {
    let headerNumber = typeof headerOrNumber === 'number' ? headerOrNumber : headerOrNumber.number.toNumber();
    // TODO: this is currently broken when using fast sync, so setting to 0
    const SYNCHED_STATE_DEPTH = 0;
    if (headerNumber < this.latestFinalizedBlockNumber - SYNCHED_STATE_DEPTH) {
      return this.archiveClient;
    }
    return this.localClient;
  }

  private async setOldestFrameIdIfNeeded(finalizedHeader: Header): Promise<void> {
    const botStateData = await this.botStateFile.get();
    if (botStateData && botStateData.oldestFrameIdToSync > 0) return;

    const oldestFrameIdToSync = this.oldestFrameIdToSync ?? (await this.getFrameIdFromHeader(finalizedHeader));
    await this.botStateFile.mutate(x => {
      x.oldestFrameIdToSync = oldestFrameIdToSync;
      x.syncProgress = this.calculateProgress(this.currentTick, [this.oldestTick, this.latestTick]);
    });
  }

  private async getFrameIdFromHeader(header: Header): Promise<number> {
    const currentFrameId = await this.frameCalculator.getForHeader(this.localClient, header);
    if (currentFrameId === undefined) {
      throw new Error(`Error getting frame id for header ${header.number.toNumber()}`);
    }
    return currentFrameId;
  }

  private async extractOwnPaidTransactionFee(
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
