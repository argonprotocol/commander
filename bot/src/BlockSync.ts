import {
  AccountMiners,
  type Accountset,
  type ArgonClient,
  CohortBidderHistory,
  type FrameSystemEventRecord,
  type GenericEvent,
  getAuthorFromHeader,
  getClient,
  getTickFromHeader,
  type Header,
  MiningRotations,
  type SpRuntimeDispatchError,
  type Vec,
} from '@argonprotocol/mainchain';
import {
  type CohortStorage,
  type ISubaccount,
  type ISyncState,
  JsonStore,
} from './storage.ts';
import { MiningFrames } from './MiningFrames.ts';
import { Dockers } from './Dockers.ts';
import type Bot from './Bot.ts';

const defaultCohort = {
  blocksMined: 0,
  argonotsMined: 0n,
  argonsMined: 0n,
  argonsMinted: 0n,
  lastBlockMinedAt: '',
};

export interface ILastProcessed {
  date: Date;
  frameId: number;
  blockNumber: number;
}

/**
 * Monitor the accountset for new cohorts and earnings. Store the earnings and bidding to files.
 * @param accountset
 * @param storage
 * @param archiveUrl - a url to an archive server in case we need to sync history
 */
export class BlockSync {
  queue: Header[] = [];
  lastProcessed?: ILastProcessed;
  accountMiners!: AccountMiners;
  archiveClient!: ArgonClient;
  localClient!: ArgonClient;
  latestFinalizedHeader!: Header;
  scheduleTimer?: NodeJS.Timeout;
  statusFile: JsonStore<ISyncState>;

  currentFrameTickRange: [number, number] = [0, 0];

  oldestTick: number = 0;
  latestTick: number = 0;
  earliestQueuedTick: number = 0;
  currentTick: number = 0;

  bidChanges?: {
    cohortFrameId: number;
    changes: {
      tick: number;
      miners: { address: string; bid: bigint }[];
      removedMiners: { address: string; bid: bigint }[];
    }[];
  };

  didProcessFinalizedBlock?: (lastProcessed: ILastProcessed) => void;

  private unsubscribe?: () => void;
  private previousNextCohortJson?: string;
  private isStopping: boolean = false;
  private miningFrames: MiningFrames;

  constructor(
    public bot: Bot,
    public accountset: Accountset,
    public storage: CohortStorage,
    public archiveUrl: string,
    private oldestFrameIdToSync?: number,
  ) {
    this.scheduleNext = this.scheduleNext.bind(this);
    this.statusFile = this.storage.syncStateFile();
    this.miningFrames = new MiningFrames();
  }

  async status(): Promise<Omit<ISyncState, 'lastBlockNumberByFrameId'>> {
    const statusFileData = (await this.statusFile.get())!;
  
    return {
      isStarting: this.bot.isStarting || undefined,
      isStarted: this.bot.isStarted || undefined,
      argonBlockNumbers: await Dockers.getArgonBlockNumbers(),
      bitcoinBlockNumbers: await Dockers.getBitcoinBlockNumbers(),
      bidsLastModifiedAt: statusFileData.bidsLastModifiedAt,
      earningsLastModifiedAt: statusFileData.earningsLastModifiedAt,
      hasWonSeats: statusFileData.hasWonSeats ?? false,
      lastBlockNumber: statusFileData.lastBlockNumber ?? 0,
      lastFinalizedBlockNumber: this.latestFinalizedHeader?.number.toNumber() ?? 0,
      oldestFrameIdToSync: statusFileData.oldestFrameIdToSync ?? 0,
      currentFrameId: statusFileData.currentFrameId ?? 0,
      loadProgress: await this.calculateLoadProgress(),
      queueDepth: this.queue.length,
    };
  }

  async calculateLoadProgress(): Promise<number> {
    const ticksQueued = this.latestTick - this.earliestQueuedTick;
    const queueProgress = this.calculateProgress(this.oldestTick + ticksQueued, [
      this.oldestTick,
      this.latestTick,
    ]);
    const processingProgress = this.calculateProgress(this.currentTick, [
      this.oldestTick,
      this.latestTick,
    ]);

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

  async start() {
    this.isStopping = false;
    this.archiveClient = await getClient(this.archiveUrl);
    this.localClient = await this.accountset.client;

    const finalizedHash = await this.localClient.rpc.chain.getFinalizedHead();

    this.latestFinalizedHeader =
      await this.localClient.rpc.chain.getHeader(finalizedHash);
    this.latestTick =
      getTickFromHeader(this.localClient, this.latestFinalizedHeader) ?? 0;
    await this.setOldestFrameIdIfNeeded();

    const statusFileData = (await this.statusFile.get())!;
    const oldestTickRange = await this.miningFrames.getTickRangeForFrame(
      this.localClient,
      statusFileData.oldestFrameIdToSync,
    );
    this.oldestTick = oldestTickRange[0];
    
    // plug any gaps in the sync state
    let header = this.latestFinalizedHeader;
    let headerBlockNumber = header.number.toNumber();
    let headerFrameId = await this.getFrameIdFromHeader(header);

    while (
      headerBlockNumber > statusFileData.lastBlockNumber + 1 &&
      headerFrameId >= statusFileData.oldestFrameIdToSync
    ) {
      console.log(`Queuing frame ${headerFrameId} block ${headerBlockNumber}`);
      this.queue.unshift(header);
      this.earliestQueuedTick = getTickFromHeader(this.localClient, header) ?? this.earliestQueuedTick;
      header = await this.getParentHeader(header);
      headerBlockNumber = header.number.toNumber();
      headerFrameId = await this.getFrameIdFromHeader(header);
    }

    console.log('Sync starting', {
      ...statusFileData,
      queue: `${this.queue.at(0)?.number.toNumber()}..${this.queue.at(-1)?.number.toNumber()}`,
    });

    const loadAt = this.queue.at(0) ?? this.latestFinalizedHeader;
    const api = await this.getRpcClient(loadAt).at(loadAt.hash);
    const startingMinerState = await this.accountset.loadRegisteredMiners(api);

    this.accountMiners = new AccountMiners(
      this.accountset,
      startingMinerState.filter(x => x.cohortId !== undefined) as any,
    );

    // catchup now
    while (this.queue.length) {
      const header = this.queue.shift()!;
      await this.processHeader(header);
    }

    this.unsubscribe = await this.localClient.rpc.chain.subscribeFinalizedHeads(
      header => {
        if (this.latestFinalizedHeader.hash === header.hash) {
          return;
        }
        this.latestFinalizedHeader = header;
        this.queue.push(header);
        this.queue.sort((a, b) => a.number.toNumber() - b.number.toNumber());
      },
    );

    await this.scheduleNext();
  }

  async scheduleNext() {
    if (this.scheduleTimer) clearTimeout(this.scheduleTimer);
    let waitTime = 500;
    if (this.queue.length) {
      // plug any gaps in the sync state
      const statusFileData = (await this.statusFile.get())!;
      let first = this.queue.at(0)!;
      while (first.number.toNumber() > statusFileData.lastBlockNumber + 1) {
        first = await this.getParentHeader(first);
        this.queue.unshift(first);
      }

      // now process the next header
      const header = this.queue.shift()!;
      try {
        await this.processHeader(header);
      } catch (e) {
        console.error(
          `Error processing block ${header.number.toNumber()} header`,
          e,
        );
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
      console.warn(
        'No tick or author found for header',
        header.number.toNumber(),
      );
      return;
    }

    const client = this.getRpcClient(header);
    const api = await client.at(header.hash);
    const events = await api.query.system.events();
    const { rotation: _r, ...cohortActivationAtFrameIds } =
      await this.accountMiners.onBlock(
        header,
        { tick, author },
        events.map(x => x.event),
      );
    const tickDate = new Date(tick * 60000);

    if (this.lastProcessed?.frameId !== currentFrameId) {
      this.currentFrameTickRange = await this.miningFrames.getTickRangeForFrame(
        this.localClient,
        currentFrameId,
      );
    }

    const didChangeBiddings = await this.syncBidding(header, events);
    await this.storage.earningsFile(currentFrameId).mutate(x => {
      if (x.lastBlockNumber >= header.number.toNumber()) {
        console.warn('Already processed block', {
          lastBlockNumber: x.lastBlockNumber,
          blockNumber: header.number.toNumber(),
        });
        return false;
      }
      x.frameProgress = this.calculateProgress(
        tick,
        this.currentFrameTickRange,
      );
      x.lastBlockNumber = header.number.toNumber();
      for (const [cohortFrameIdStr, earnings] of Object.entries(
        cohortActivationAtFrameIds,
      )) {
        const cohortFrameId = Number(cohortFrameIdStr);
        const { argonsMinted, argonotsMined, argonsMined } = earnings;
        x.byCohortFrameId[cohortFrameId] ??= structuredClone(defaultCohort);
        x.byCohortFrameId[cohortFrameId].argonotsMined += argonotsMined;
        x.byCohortFrameId[cohortFrameId].argonsMined += argonsMined;
        x.byCohortFrameId[cohortFrameId].argonsMinted += argonsMinted;
        if (argonsMined > 0n) {
          x.byCohortFrameId[cohortFrameId].blocksMined += 1;
          x.byCohortFrameId[cohortFrameId].lastBlockMinedAt =
            tickDate.toString();
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

    await this.statusFile.mutate(x => {
      if (x.lastBlockNumber >= header.number.toNumber()) {
        return false;
      }
      if (didChangeBiddings) x.bidsLastModifiedAt = new Date();
      x.earningsLastModifiedAt = new Date();
      x.lastBlockNumber = header.number.toNumber();
      x.currentFrameId = currentFrameId;
      x.loadProgress = this.calculateProgress(this.currentTick, [
        this.oldestTick,
        this.latestTick,
      ]);
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
    let headerNumber =
      typeof headerOrNumber === 'number'
        ? headerOrNumber
        : headerOrNumber.number.toNumber();
    // TODO: this is currently broken when using fast sync, so setting to 0
    const SYNCHED_STATE_DEPTH = 0;
    if (
      headerNumber <
      this.latestFinalizedHeader.number.toNumber() - SYNCHED_STATE_DEPTH
    ) {
      return this.archiveClient;
    }
    return this.localClient;
  }

  private async setOldestFrameIdIfNeeded() {
    const statusFileData = await this.statusFile.get();
    if (statusFileData && statusFileData.oldestFrameIdToSync > 0) return;
    const oldestFrameIdToSync =
      this.oldestFrameIdToSync ??
      (await this.getFrameIdFromHeader(this.latestFinalizedHeader));
    await this.statusFile.mutate(x => {
      x.oldestFrameIdToSync = oldestFrameIdToSync;
      x.loadProgress = this.calculateProgress(this.currentTick, [
        this.oldestTick,
        this.latestTick,
      ]);
    });
  }

  private async getParentHeader(header: Header): Promise<Header> {
    return this.getRpcClient(header).rpc.chain.getHeader(header.parentHash);
  }

  private async getFrameIdFromHeader(header: Header): Promise<number> {
    const currentFrameId = await new MiningRotations().getForHeader(
      this.localClient,
      header,
    );
    if (currentFrameId === undefined) {
      throw new Error(
        `Error getting frame id for header ${header.number.toNumber()}`,
      );
    }
    return currentFrameId;
  }

  private async syncBidding(
    header: Header,
    events: Vec<FrameSystemEventRecord>,
  ): Promise<boolean> {
    const client = this.getRpcClient(header);
    const api = await client.at(header.hash);
    const headerTick = getTickFromHeader(client, header);

    const blockNumber = header.number.toNumber();
    const cohortFrameId = await api.query.miningSlot
      .nextCohortId()
      .then(x => x.toNumber());
    const bidsFile = this.storage.bidsFile(cohortFrameId);
    const nextCohort = await api.query.miningSlot.nextSlotCohort();

    let didChangeBiddings = false;
    if (this.previousNextCohortJson !== nextCohort.toJSON()) {
      this.previousNextCohortJson = JSON.stringify(nextCohort.toJSON());
      didChangeBiddings = await bidsFile.mutate(async x => {
        if (x.lastBlockNumber >= blockNumber) {
          console.warn('Already processed block', {
            lastStored: x.lastBlockNumber,
            blockNumber: blockNumber,
          });
          return false;
        }
        if (!x.argonsToBeMinedPerBlock) {
          const data = await CohortBidderHistory.getStartingData(api);
          x.argonotsStakedPerSeat = data.argonotsPerSeat;
          x.argonotsUsdPrice = data.argonotUsdPrice;
          x.argonsToBeMinedPerBlock = data.cohortArgonsPerBlock;
        }
        x.frameBiddingProgress = this.calculateProgress(
          headerTick,
          this.currentFrameTickRange,
        );
        x.lastBlockNumber = blockNumber;
        // we just want to know who has a winning bid so we don't outbid them on restart
        x.subaccounts = nextCohort
          .map((c, i): ISubaccount | undefined => {
            const address = c.accountId.toHuman();
            if (!this.accountset.subAccountsByAddress[address])
              return undefined;
            const ourMiner = this.accountset.subAccountsByAddress[address];
            return {
              index: ourMiner.index,
              address,
              bidPosition: i,
              lastBidAtTick: c.bidAtTick?.toNumber(),
            };
          })
          .filter(x => x !== undefined);
      });

      if (this.bidChanges?.cohortFrameId !== cohortFrameId) {
        this.bidChanges = { cohortFrameId, changes: [] };
      }

      const previous = this.bidChanges?.changes.at(-1)?.miners ?? [];
      this.bidChanges?.changes.push({
        tick: headerTick!,
        miners: nextCohort.map(x => ({
          address: x.accountId.toHuman(),
          bid: x.bid.toBigInt(),
        })),
        removedMiners: previous
          .map(x => {
            const nextBid = nextCohort.find(
              y => y.accountId.toHuman() === x.address,
            );
            if (!nextBid) {
              return x;
            }
            return undefined;
          })
          .filter(x => x !== undefined),
      });
    }

    for (const { event, phase } of events) {
      if (phase.isApplyExtrinsic) {
        const extrinsicIndex = phase.asApplyExtrinsic.toNumber();
        const extrinsicEvents = events.filter(
          x =>
            x.phase.isApplyExtrinsic &&
            x.phase.asApplyExtrinsic.toNumber() === extrinsicIndex,
        );
        const transactionFee = await this.extractTransactionFee(
          client,
          event,
          extrinsicEvents,
        );
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

      if (
        phase.isFinalization &&
        client.events.miningSlot.NewMiners.is(event)
      ) {
        console.log('New miners event', event.data.toJSON());
        let hasWonSeats = false;
        const [_startIndex, newMiners, _released, cohortFrameId] = event.data;
        await this.storage.bidsFile(cohortFrameId.toNumber()).mutate(x => {
          x.seatsWon = 0;
          x.argonsBidTotal = 0n;
          x.subaccounts = [];
          x.lastBlockNumber = blockNumber;

          let bidPosition = 0;
          for (const miner of newMiners) {
            const address = miner.accountId.toHuman();
            const argonsBid = miner.bid.toBigInt();
            const ourMiner = this.accountset.subAccountsByAddress[address];

            if (ourMiner) {
              hasWonSeats = true;
              x.seatsWon += 1;
              x.argonsBidTotal += argonsBid;
              x.subaccounts.push({
                index: ourMiner.index,
                address,
                lastBidAtTick: miner.bidAtTick?.toNumber(),
                bidPosition,
                argonsBid,
              });
            }
            bidPosition++;
          }
        });
        await this.statusFile.mutate(x => {
          x.bidsLastModifiedAt = new Date();
          x.loadProgress = this.calculateProgress(this.currentTick, [
            this.oldestTick,
            this.latestTick,
          ]);
          if (hasWonSeats) {
            x.hasWonSeats = true;
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

  private calculateProgress(
    tick: number | undefined,
    tickRange: [number, number] | undefined,
  ): number {
    if (!tick || !tickRange) return 0;
    const progress = tick
      ? (tick - tickRange[0]) / (tickRange[1] - tickRange[0])
      : 0;
    return Math.round(progress * 10000) / 100;
  }
}
