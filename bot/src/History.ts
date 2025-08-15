import { ExtrinsicError, JsonExt } from '@argonprotocol/mainchain';
import { MiningFrames } from '@argonprotocol/commander-calculator';
import {
  BotActivityType,
  type IBotActivity,
  type IBotActivityBidReceived,
  type IHistoryFile,
} from './interfaces/IHistoryFile.ts';
import type { Storage } from './Storage.ts';
import Queue from 'p-queue';

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
  private lastBids: { address: string; bidMicrogons: bigint }[] = [];

  private cohortStartingFrameId!: number;
  private myAddresses: Set<string> = new Set();
  private unsavedActivities: IBotActivity[] = [];

  private lastIdTick: number = 0;
  private lastIdCounter: number = 0;
  private queue = new Queue({ concurrency: 1, autoStart: true });

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

  public async initCohort(cohortStartingFrameId: number, myAddresses: Set<string>) {
    this.cohortStartingFrameId = cohortStartingFrameId;
    this.myAddresses = myAddresses;
    this.maxSeatsInPlay = this.myAddresses.size;
    const activitiesToSave = this.unsavedActivities;
    this.unsavedActivities = [];

    console.log('SAVING ACTIVITIES TO HISTORY FILE', activitiesToSave);
    void this.queue.add(() =>
      this.storage.historyFile(cohortStartingFrameId).mutate((history: IHistoryFile) => {
        history.activities.push(...activitiesToSave);
      }),
    );
  }

  public handleStarting() {
    console.log('STARTING');
    this.appendActivities({
      tick: MiningFrames.calculateCurrentTickFromSystemTime(),
      type: BotActivityType.Starting,
      data: {},
    });
  }

  public handleDockersConfirmed() {
    console.log('DOCKERS CONFIRMED');
    this.appendActivities({
      tick: MiningFrames.calculateCurrentTickFromSystemTime(),
      type: BotActivityType.DockersConfirmed,
      data: {},
    });
  }

  public handleStartedSyncing() {
    console.log('STARTED SYNCING');
    this.appendActivities({
      tick: MiningFrames.calculateCurrentTickFromSystemTime(),
      type: BotActivityType.StartedSyncing,
      data: {},
    });
  }

  public handleFinishedSyncing() {
    console.log('FINISHED SYNCING');
    this.appendActivities({
      tick: MiningFrames.calculateCurrentTickFromSystemTime(),
      type: BotActivityType.FinishedSyncing,
      data: {},
    });
  }

  public handleReady() {
    console.log('READY');
    this.appendActivities({
      tick: MiningFrames.calculateCurrentTickFromSystemTime(),
      type: BotActivityType.Ready,
      data: {},
    });
  }

  public handleError(error: Error) {
    console.log('ERROR', error);
    this.appendActivities({
      tick: MiningFrames.calculateCurrentTickFromSystemTime(),
      type: BotActivityType.Error,
      data: { name: error.name, message: error.message },
    });
  }

  public async handleShutdown() {
    console.log('SHUTDOWN');
    this.appendActivities({
      tick: MiningFrames.calculateCurrentTickFromSystemTime(),
      type: BotActivityType.Shutdown,
      data: {},
    });
    await this.queue.onIdle();
  }

  public handleBidsSubmitted(
    tick: number,
    blockNumber: number,
    param: {
      microgonsPerSeat: bigint;
      txFeePlusTip: bigint;
      submittedCount: number;
    },
  ) {
    console.log('BIDS SUBMITTED', { tick, blockNumber, param });
    this.appendActivities({
      tick,
      blockNumber,
      type: BotActivityType.BidsSubmitted,
      data: param,
    });
  }

  public handleBidsRejected(
    tick: number,
    blockNumber: number,
    param: {
      microgonsPerSeat: bigint;
      rejectedCount: number;
      submittedCount: number;
      bidError?: ExtrinsicError;
    },
  ) {
    console.log('BIDS REJECTED', { tick, blockNumber, param });
    this.appendActivities({
      tick,
      blockNumber,
      type: BotActivityType.BidsRejected,
      data: param,
    });
  }

  public handleSeatFluctuation(
    tick: number,
    blockNumber: number,
    newMaxSeats: number,
    reason: SeatReductionReason,
    availableMicrogons: bigint,
  ) {
    if (newMaxSeats < this.maxSeatsInPlay) {
      this.appendActivities({
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
      this.appendActivities({
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

  public handleIncomingBids(
    tick: number,
    blockNumber: number,
    nextEntrants: { address: string; bidMicrogons: bigint }[],
  ) {
    console.log('INCOMING BIDS', { tick, blockNumber, bids: nextEntrants });
    const hasDiffs = JsonExt.stringify(nextEntrants) !== JsonExt.stringify(this.lastBids);
    this.lastProcessedBlockNumber = Math.max(blockNumber, this.lastProcessedBlockNumber);

    if (hasDiffs) {
      for (const [i, { address, bidMicrogons }] of nextEntrants.entries()) {
        const prevBidIndex = this.lastBids.findIndex(y => y.address === address);
        const entry: IBotActivityBidReceived = {
          bidderAddress: address,
          microgonsPerSeat: bidMicrogons,
          bidPosition: i,
        };
        if (prevBidIndex !== -1) {
          const prevBidAmount = this.lastBids[prevBidIndex].bidMicrogons;
          if (prevBidAmount !== bidMicrogons) {
            entry.previousMicrogonsPerSeat = prevBidAmount;
          }
          entry.previousBidPosition = prevBidIndex;
        }
        this.appendActivities({
          tick,
          blockNumber,
          type: BotActivityType.BidReceived,
          data: entry,
        });
      }

      for (const [i, { address, bidMicrogons }] of this.lastBids.entries()) {
        const nextBid = nextEntrants.some(y => y.address === address);
        if (!nextBid) {
          this.appendActivities({
            tick,
            blockNumber,
            type: BotActivityType.BidReceived,
            data: {
              bidderAddress: address,
              microgonsPerSeat: bidMicrogons,
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

  private appendActivities(...activities: Omit<IBotActivity, 'id'>[]) {
    for (const activity of activities) {
      (activity as IBotActivity).id ??= this.createId(activity.tick);
      (activity as IBotActivity).frameId ??= this.cohortStartingFrameId;
    }

    const cohortFrameId = this.cohortStartingFrameId;
    if (cohortFrameId) {
      void this.queue.add(() =>
        this.storage.historyFile(cohortFrameId).mutate((history: IHistoryFile) => {
          history.activities.push(...(activities as IBotActivity[]));
        }),
      );
    } else {
      this.unsavedActivities.push(...(activities as IBotActivity[]));
    }
  }
}
