import BigNumber from 'bignumber.js';
import { type IBidsFile, type IWinningBid } from '@argonprotocol/commander-bot';
import { IDashboardFrameStats, IDashboardGlobalStats } from '../interfaces/IStats';
import { Db } from './Db';
import { Config } from './Config';
import { bigIntMax } from '@argonprotocol/commander-calculator/src/utils';
import { ICohortRecord } from '../interfaces/db/ICohortRecord';
import { botEmitter } from './Bot';
import { createDeferred, ensureOnlyOneInstance } from './Utils';
import IDeferred from '../interfaces/IDeferred';
import { MiningFrames } from '@argonprotocol/commander-calculator/src/MiningFrames';
import { bigNumberToBigInt } from '@argonprotocol/commander-calculator';

interface IMyMiningSeats {
  seatCount: number;
  transactionFeesTotal: bigint;
  microgonsBidTotal: bigint;
  micronotsStakedTotal: bigint;
  microgonsMinedTotal: bigint;
  micronotsMinedTotal: bigint;
  microgonsMintedTotal: bigint;
  microgonsToBeMined: bigint;
  microgonsToBeMinted: bigint;
  micronotsToBeMined: bigint;
}

interface IMyMiningBids {
  bidCount: number;
  microgonsBidTotal: bigint;
}

export class Stats {
  public latestFrameId: number;
  public selectedFrameId!: number;
  public selectedCohortTickRange!: [number, number];

  public myMiningSeats: IMyMiningSeats;
  public myMiningBids: IMyMiningBids;

  public allWinningBids: IWinningBid[];

  public global: IDashboardGlobalStats;
  public frames: IDashboardFrameStats[];

  public argonActivity: any[];
  public bitcoinActivity: any[];
  public biddingActivity: any[];

  public accruedMicrogonProfits: bigint;

  public isLoaded: boolean;
  public isLoadedPromise: Promise<void>;

  private isLoading: boolean = false;
  private isLoadedDeferred!: IDeferred<void>;

  private db!: Db;

  private config!: Config;
  private dbPromise: Promise<Db>;

  private dashboardSubscribers: number = 0;
  private dashboardHasUpdates: boolean = true;

  private activitySubscribers: number = 0;
  private activityHasUpdates: boolean = true;

  constructor(dbPromise: Promise<Db>, config: Config) {
    ensureOnlyOneInstance(this.constructor);

    this.isLoaded = false;

    this.allWinningBids = [];

    this.latestFrameId = MiningFrames.calculateCurrentFrameIdFromSystemTime();
    this.selectFrameId(this.latestFrameId, true);

    this.myMiningSeats = {
      seatCount: 0,
      transactionFeesTotal: 0n,
      microgonsBidTotal: 0n,
      micronotsStakedTotal: 0n,
      microgonsMinedTotal: 0n,
      micronotsMinedTotal: 0n,
      microgonsMintedTotal: 0n,
      microgonsToBeMined: 0n,
      microgonsToBeMinted: 0n,
      micronotsToBeMined: 0n,
    };

    this.myMiningBids = {
      bidCount: 0,
      microgonsBidTotal: 0n,
    };

    this.global = {
      seatsTotal: 0,
      framesCompleted: 0,
      framesRemaining: 0,
      framedCost: 0n,
      microgonsBidTotal: 0n,
      transactionFeesTotal: 0n,
      micronotsMinedTotal: 0n,
      microgonsMinedTotal: 0n,
      microgonsMintedTotal: 0n,
    };

    this.frames = [];

    this.argonActivity = [];
    this.bitcoinActivity = [];
    this.biddingActivity = [];

    this.accruedMicrogonProfits = 0n;

    this.dbPromise = dbPromise;
    this.config = config;

    this.isLoadedDeferred = createDeferred<void>();
    this.isLoadedPromise = this.isLoadedDeferred.promise;
  }

  public get prevFrameId(): number | null {
    const newFrameId = this.selectedFrameId - 1;
    if (newFrameId < 1) return null;
    return newFrameId;
  }

  public get nextFrameId(): number | null {
    const newFrameId = this.selectedFrameId + 1;
    if (newFrameId > this.latestFrameId) return null;
    return newFrameId;
  }

  public selectFrameId(frameId: number, skipDashboardUpdate: boolean = false) {
    const firstFrameTickRange = MiningFrames.getTickRangeForFrameFromSystemTime(frameId);
    const lastFrameTickRange = MiningFrames.getTickRangeForFrameFromSystemTime(frameId + 9);
    this.selectedFrameId = frameId;
    this.selectedCohortTickRange = [firstFrameTickRange[0], lastFrameTickRange[1]];
    if (skipDashboardUpdate) return;

    this.updateDashboard().catch(console.error);
  }

  public async load() {
    if (this.isLoading || this.isLoaded) return;
    this.isLoading = true;

    await this.config.isLoadedPromise;
    this.db = await this.dbPromise;

    botEmitter.on('updated-cohort-data', async (frameId: number) => {
      await this.updateMiningSeats();

      const isOnLatestFrame = this.selectedFrameId === this.latestFrameId;
      this.latestFrameId = frameId;
      if (!isOnLatestFrame) return;

      this.selectFrameId(frameId, true);
      this.updateAccruedMicrogonProfits();

      if (this.isSubscribedToDashboard) {
        await this.updateDashboard();
        this.dashboardHasUpdates = false;
      } else {
        this.dashboardHasUpdates = true;
      }

      if (this.isSubscribedToActivity) {
        await this.updateBitcoinActivities();
        await this.updateArgonActivities();
        await this.updateBotActivities();
        this.activityHasUpdates = false;
      } else {
        this.activityHasUpdates = true;
      }
    });

    botEmitter.on('updated-bids-data', async (_: IBidsFile['winningBids']) => {
      this.updateMiningBids();
    });

    botEmitter.on('updated-bitcoin-activity', async () => {
      if (this.isSubscribedToActivity) {
        await this.updateBitcoinActivities();
        this.activityHasUpdates = false;
      } else {
        this.activityHasUpdates = true;
      }
    });

    botEmitter.on('updated-argon-activity', async () => {
      if (this.isSubscribedToActivity) {
        await this.updateArgonActivities();
        this.activityHasUpdates = false;
      } else {
        this.activityHasUpdates = true;
      }
    });

    botEmitter.on('updated-bidding-activity', async () => {
      if (this.isSubscribedToActivity) {
        await this.updateBotActivities();
        this.activityHasUpdates = false;
      } else {
        this.activityHasUpdates = true;
      }
    });

    await this.updateMiningSeats();
    await this.updateMiningBids();
    await this.updateAccruedMicrogonProfits();

    this.isLoaded = true;
    this.isLoading = false;
    this.isLoadedDeferred.resolve();
  }

  public async subscribeToDashboard(): Promise<void> {
    this.dashboardSubscribers++;
    if (this.dashboardSubscribers > 1) return;

    await this.isLoadedDeferred.promise;

    if (this.dashboardHasUpdates) {
      this.dashboardHasUpdates = false;
      await this.updateDashboard();
    }
  }

  public async subscribeToActivity(): Promise<void> {
    this.activitySubscribers++;
    if (this.activitySubscribers > 1) return;

    await this.isLoadedDeferred.promise;

    if (this.activityHasUpdates) {
      this.activityHasUpdates = false;
      await Promise.all([this.updateBitcoinActivities(), this.updateArgonActivities(), this.updateBotActivities()]);
    }
  }

  public async unsubscribeFromDashboard(): Promise<void> {
    this.dashboardSubscribers--;
    if (this.dashboardSubscribers < 0) this.dashboardSubscribers = 0;
  }

  public async unsubscribeFromActivity(): Promise<void> {
    this.activitySubscribers--;
    if (this.activitySubscribers < 0) this.activitySubscribers = 0;
  }

  private get isSubscribedToDashboard(): boolean {
    return this.dashboardSubscribers > 0;
  }

  private get isSubscribedToActivity(): boolean {
    return this.activitySubscribers > 0;
  }

  private async updateDashboard(): Promise<void> {
    this.global = await this.fetchGlobalFromDb();
    this.frames = await this.fetchFramesFromDb();
  }

  private async updateAccruedMicrogonProfits(): Promise<void> {
    this.accruedMicrogonProfits = await this.db.framesTable.fetchAccruedMicrogonProfits();
  }

  private async updateMiningSeats(): Promise<void> {
    this.myMiningSeats = await this.fetchActiveMiningSeatsFromDb();
  }

  private async updateBitcoinActivities(): Promise<void> {
    this.bitcoinActivity = await this.db.bitcoinActivitiesTable.fetchLastFiveRecords();
  }

  private async updateArgonActivities(): Promise<void> {
    this.argonActivity = await this.db.argonActivitiesTable.fetchLastFiveRecords();
  }

  private async updateBotActivities(): Promise<void> {
    this.biddingActivity = await this.db.botActivitiesTable.fetchRecentRecords(15);
  }

  private async updateMiningBids(): Promise<void> {
    const frameBids = await this.db.frameBidsTable.fetchForFrameId(this.latestFrameId, 10);
    this.allWinningBids = frameBids.map(x => {
      return {
        address: x.address,
        subAccountIndex: x.subAccountIndex,
        lastBidAtTick: x.lastBidAtTick,
        bidPosition: x.bidPosition,
        microgonsPerSeat: x.microgonsBid,
      };
    });

    const myWinningBids = this.allWinningBids.filter(bid => typeof bid.subAccountIndex === 'number');
    this.myMiningBids.bidCount = myWinningBids.length;
    this.myMiningBids.microgonsBidTotal = myWinningBids.reduce((acc, bid) => acc + (bid.microgonsPerSeat || 0n), 0n);
  }

  private async fetchActiveMiningSeatsFromDb(): Promise<IMyMiningSeats> {
    let seatCount = 0;
    let transactionFeesTotal = 0n;
    let microgonsBidTotal = 0n;
    let micronotsStakedTotal = 0n;
    let microgonsMinedTotal = 0n;
    let micronotsMinedTotal = 0n;
    let microgonsMintedTotal = 0n;
    let microgonsToBeMined = 0n;
    let microgonsToBeMinted = 0n;
    let micronotsToBeMined = 0n;

    const activeCohorts = await this.db.cohortsTable.fetchActiveCohorts(this.latestFrameId);

    for (const cohort of activeCohorts) {
      // Scale factor to preserve precision (cohort.progress has 3 decimal places)
      // factor = (100 - progress) / 100, scaled by 100000 for 3 decimal precision
      const remainingRewardsPerSeat = this.calculateRemainingRewardsExpectedPerSeat(cohort);
      seatCount += cohort.seatCountWon;
      microgonsBidTotal += cohort.microgonsBidPerSeat * BigInt(cohort.seatCountWon);
      transactionFeesTotal += cohort.transactionFeesTotal * BigInt(cohort.seatCountWon);
      micronotsStakedTotal += cohort.micronotsStakedPerSeat * BigInt(cohort.seatCountWon);
      microgonsToBeMined += remainingRewardsPerSeat.microgonsToBeMined * BigInt(cohort.seatCountWon);
      microgonsToBeMinted += remainingRewardsPerSeat.microgonsToBeMinted * BigInt(cohort.seatCountWon);
      micronotsToBeMined += remainingRewardsPerSeat.micronotsToBeMined * BigInt(cohort.seatCountWon);
    }

    const activeCohortFrames = await this.db.cohortFramesTable.fetchActiveCohortFrames(this.latestFrameId);

    for (const cohortFrame of activeCohortFrames) {
      microgonsMinedTotal += cohortFrame.microgonsMinedTotal;
      micronotsMinedTotal += cohortFrame.micronotsMinedTotal;
      microgonsMintedTotal += cohortFrame.microgonsMintedTotal;
    }

    return {
      seatCount,
      transactionFeesTotal,
      microgonsBidTotal,
      micronotsStakedTotal,
      microgonsMinedTotal,
      micronotsMinedTotal,
      microgonsMintedTotal,
      microgonsToBeMined,
      microgonsToBeMinted,
      micronotsToBeMined,
    };
  }

  private calculateRemainingRewardsExpectedPerSeat(cohort: ICohortRecord): {
    microgonsToBeMined: bigint;
    microgonsToBeMinted: bigint;
    micronotsToBeMined: bigint;
  } {
    const microgonsExpected = bigIntMax(cohort.microgonsBidPerSeat, cohort.microgonsToBeMinedPerSeat);
    const microgonsExpectedToBeMinted = microgonsExpected - cohort.microgonsToBeMinedPerSeat;

    const factorBn = BigNumber(100 - cohort.progress).dividedBy(100);

    const microgonsToBeMinedBn = BigNumber(cohort.microgonsToBeMinedPerSeat).multipliedBy(factorBn);
    const micronotsToBeMinedBn = BigNumber(cohort.micronotsToBeMinedPerSeat).multipliedBy(factorBn);
    const microgonsToBeMintedBn = BigNumber(microgonsExpectedToBeMinted).multipliedBy(factorBn);

    const microgonsToBeMined = bigNumberToBigInt(microgonsToBeMinedBn);
    const microgonsToBeMinted = bigNumberToBigInt(microgonsToBeMintedBn);
    const micronotsToBeMined = bigNumberToBigInt(micronotsToBeMinedBn);

    return {
      microgonsToBeMined,
      microgonsToBeMinted,
      micronotsToBeMined,
    };
  }

  private async fetchFramesFromDb(): Promise<IDashboardFrameStats[]> {
    const lastYear = await this.db.framesTable.fetchLastYear();

    let maxProfitPct = Math.min(Math.max(...lastYear.map(x => x.profitPct)), 1_000);
    return lastYear
      .map(x => {
        let score = Math.min(x.profitPct, 1_000);
        if (x.profitPct > 0) {
          score = (200 * score) / maxProfitPct;
        }
        return {
          ...x,
          score,
        };
      })
      .reverse();
  }

  private async fetchGlobalFromDb(): Promise<IDashboardGlobalStats> {
    const currentFrameId = await this.db.framesTable.latestId();
    const globalStats1 = await this.db.cohortsTable.fetchGlobalStats(currentFrameId);
    const globalStats2 = await this.db.cohortFramesTable.fetchGlobalStats();

    return {
      seatsTotal: globalStats1.seatsTotal,
      framesCompleted: globalStats1.framesCompleted,
      framesRemaining: globalStats1.framesRemaining,
      framedCost: globalStats1.framedCost,
      microgonsBidTotal: globalStats1.microgonsBidTotal,
      transactionFeesTotal: globalStats1.transactionFeesTotal,
      micronotsMinedTotal: globalStats2.micronotsMinedTotal,
      microgonsMinedTotal: globalStats2.microgonsMinedTotal,
      microgonsMintedTotal: globalStats2.microgonsMintedTotal,
    };
  }
}
