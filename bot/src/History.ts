import { type AccountId, Compact, ExtrinsicError, JsonExt, u128 } from '@argonprotocol/mainchain';
import { MiningFrames } from '@argonprotocol/commander-calculator';
import {
  BotActivityType,
  type IBotActivity,
  type IBotActivityBidReceived,
  type IHistoryFile,
} from './interfaces/IHistoryFile.ts';
import type { Storage } from './Storage.ts';

export enum SeatReductionReason {
  InsufficientFunds = 'InsufficientFunds',
  MaxBidTooLow = 'MaxBidTooLow',
  MaxBudgetTooLow = 'MaxBudgetTooLow',
}

export class History {
  public maxSeatsInPlay: number = 0;
  public maxSeatsReductionReason: SeatReductionReason | undefined;
  public lastProcessedBlockNumber: number = 0;

  private storage: Storage;
  private lastBids: { address: string; bid: bigint }[] = [];

  private cohortStartingFrameId!: number;
  private myAddresses: Set<string> = new Set();
  private unsavedActivities: IBotActivity[] = [];

  private lastIdTick: number = 0;
  private lastIdCounter: number = 0;

  constructor(storage: Storage) {
    this.storage = storage;
  }

  public get recent(): Promise<IHistoryFile> {
    return new Promise(async (resolve, reject) => {
      const activities: IBotActivity[] = [];
      let lastModifiedAt: Date | undefined;
      try {
        if (this.cohortStartingFrameId) {
          const historyFile = (await this.storage.historyFile(this.cohortStartingFrameId).get())!;
          lastModifiedAt = historyFile.lastModifiedAt;
          activities.push(...historyFile.activities.slice(-20));
        } else {
          activities.push(...this.unsavedActivities);
        }
        resolve({
          lastModifiedAt,
          activities,
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  public async initCohort(cohortStartingFrameId: number, myAddresses: Set<string>): Promise<void> {
    this.cohortStartingFrameId = cohortStartingFrameId;
    this.myAddresses = myAddresses;
    this.maxSeatsInPlay = this.myAddresses.size;
    const activitiesToSave = this.unsavedActivities;
    this.unsavedActivities = [];

    console.log('SAVING ACTIVITIES TO HISTORY FILE', activitiesToSave);
    await this.storage.historyFile(this.cohortStartingFrameId).mutate((history: IHistoryFile) => {
      history.activities.push(...(activitiesToSave as IBotActivity[]));
    });
  }

  public async handleStarting(): Promise<void> {
    console.log('STARTING');
    await this.appendActivities({
      tick: MiningFrames.calculateCurrentTickFromSystemTime(),
      type: BotActivityType.Starting,
      data: {},
    });
  }

  public async handleDockersConfirmed(): Promise<void> {
    console.log('DOCKERS CONFIRMED');
    await this.appendActivities({
      tick: MiningFrames.calculateCurrentTickFromSystemTime(),
      type: BotActivityType.DockersConfirmed,
      data: {},
    });
  }

  public async handleStartedSyncing(): Promise<void> {
    console.log('STARTED SYNCING');
    await this.appendActivities({
      tick: MiningFrames.calculateCurrentTickFromSystemTime(),
      type: BotActivityType.StartedSyncing,
      data: {},
    });
  }

  public async handleFinishedSyncing(): Promise<void> {
    console.log('FINISHED SYNCING');
    await this.appendActivities({
      tick: MiningFrames.calculateCurrentTickFromSystemTime(),
      type: BotActivityType.FinishedSyncing,
      data: {},
    });
  }

  public async handleReady() {
    console.log('READY');
    await this.appendActivities({
      tick: MiningFrames.calculateCurrentTickFromSystemTime(),
      type: BotActivityType.Ready,
      data: {},
    });
  }

  public async handleError(error: Error): Promise<void> {
    console.log('ERROR', error);
    await this.appendActivities({
      tick: MiningFrames.calculateCurrentTickFromSystemTime(),
      type: BotActivityType.Error,
      data: { name: error.name, message: error.message },
    });
  }

  public async handleShutdown(): Promise<void> {
    console.log('SHUTDOWN');
    await this.appendActivities({
      tick: MiningFrames.calculateCurrentTickFromSystemTime(),
      type: BotActivityType.Shutdown,
      data: {},
    });
  }

  public async handleBidsSubmitted(
    tick: number,
    blockNumber: number,
    param: {
      microgonsPerSeat: bigint;
      txFeePlusTip: bigint;
      submittedCount: number;
    },
  ): Promise<void> {
    console.log('BIDS SUBMITTED', { tick, blockNumber, param });
    await this.appendActivities({
      tick,
      blockNumber,
      type: BotActivityType.BidsSubmitted,
      data: param,
    });
  }

  public async handleBidsRejected(
    tick: number,
    blockNumber: number,
    param: {
      microgonsBid: bigint;
      rejectedCount: number;
      submittedCount: number;
      bidError?: ExtrinsicError;
    },
  ): Promise<void> {
    console.log('BIDS REJECTED', { tick, blockNumber, param });
    await this.appendActivities({
      tick,
      blockNumber,
      type: BotActivityType.BidsRejected,
      data: param,
    });
  }

  public async handleSeatFluctuation(
    tick: number,
    blockNumber: number,
    newMaxSeats: number,
    reason: SeatReductionReason,
    availableMicrogons: bigint,
  ): Promise<void> {
    console.log('SEAT FLUCTUATION', { tick, blockNumber, newMaxSeats, reason, availableMicrogons });
    if (newMaxSeats < this.maxSeatsInPlay) {
      await this.appendActivities({
        tick,
        blockNumber,
        type: BotActivityType.SeatReduction,
        data: {
          reason,
          maxSeatsInPlay: newMaxSeats,
          prevSeatsInPlay: this.maxSeatsInPlay,
          availableMicrogons: availableMicrogons,
        },
      });
    } else if (newMaxSeats > this.maxSeatsInPlay) {
      await this.appendActivities({
        tick,
        blockNumber,
        type: BotActivityType.SeatExpansion,
        data: {
          reason,
          maxSeatsInPlay: newMaxSeats,
          prevSeatsInPlay: this.maxSeatsInPlay,
          availableMicrogons: availableMicrogons,
        },
      });
    }

    this.maxSeatsInPlay = newMaxSeats;
  }

  public async handleIncomingBids(
    tick: number,
    blockNumber: number,
    bids: { accountId: AccountId; bid: u128 | Compact<u128> }[],
  ): Promise<void> {
    console.log('INCOMING BIDS', { tick, blockNumber, bids });
    const nextEntrants: { address: string; bid: bigint }[] = [];
    for (const x of bids) {
      const bid = x.bid.toBigInt();
      const address = x.accountId.toHuman();
      nextEntrants.push({ address, bid });
    }

    const hasDiffs = JsonExt.stringify(nextEntrants) !== JsonExt.stringify(this.lastBids);
    this.lastProcessedBlockNumber = Math.max(blockNumber, this.lastProcessedBlockNumber);

    if (hasDiffs) {
      for (const [i, { address, bid }] of nextEntrants.entries()) {
        const prevBidIndex = this.lastBids.findIndex(y => y.address === address);
        const entry: IBotActivityBidReceived = {
          bidderAddress: address,
          microgonsBid: bid,
          bidPosition: i,
        };
        if (prevBidIndex !== -1) {
          const prevBidAmount = this.lastBids[prevBidIndex].bid;
          if (prevBidAmount !== bid) {
            entry.previousMicrogonsBid = prevBidAmount;
          }
          entry.previousBidPosition = prevBidIndex;
        }
        await this.appendActivities({
          tick,
          blockNumber,
          type: BotActivityType.BidReceived,
          data: entry,
        });
      }

      for (const [i, { address, bid }] of this.lastBids.entries()) {
        const nextBid = nextEntrants.some(y => y.address === address);
        if (!nextBid) {
          await this.appendActivities({
            tick,
            blockNumber,
            type: BotActivityType.BidReceived,
            data: {
              bidderAddress: address,
              microgonsBid: bid,
              bidPosition: null,
              previousBidPosition: i,
            },
          });
        }
      }
      this.lastBids = nextEntrants;
    }
  }

  private createId(tick: number): number {
    if (tick !== this.lastIdTick) {
      this.lastIdTick = tick;
      this.lastIdCounter = 0;
    }

    const count = this.lastIdCounter.toString().padStart(4, '0');
    const id = Number(`${tick}${count}`);
    this.lastIdCounter++;

    return id;
  }

  private async appendActivities(...activities: Omit<IBotActivity, 'id'>[]) {
    for (const activity of activities) {
      (activity as any).id ??= this.createId(activity.tick);
      (activity as any).frameId ??= this.cohortStartingFrameId;
    }

    if (this.cohortStartingFrameId) {
      await this.storage.historyFile(this.cohortStartingFrameId).mutate((history: IHistoryFile) => {
        history.activities.push(...(activities as IBotActivity[]));
      });
    } else {
      this.unsavedActivities.push(...(activities as IBotActivity[]));
    }
  }
}
