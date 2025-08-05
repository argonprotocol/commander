import BigNumber from 'bignumber.js';
import { type IBidsFile, type IWinningBid } from '@argonprotocol/commander-bot';
import { IDashboardGlobalStats, IDashboardFrameStats } from '../interfaces/IStats';
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
  transactionFees: bigint;
  microgonsBid: bigint;
  micronotsStaked: bigint;
  microgonsMined: bigint;
  micronotsMined: bigint;
  microgonsMinted: bigint;
  microgonsToBeMined: bigint;
  microgonsToBeMinted: bigint;
  micronotsToBeMined: bigint;
}

interface IMyMiningBids {
  bidCount: number;
  microgonsBid: bigint;
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
      transactionFees: 0n,
      microgonsBid: 0n,
      micronotsStaked: 0n,
      microgonsMined: 0n,
      micronotsMined: 0n,
      microgonsMinted: 0n,
      microgonsToBeMined: 0n,
      microgonsToBeMinted: 0n,
      micronotsToBeMined: 0n,
    };

    this.myMiningBids = {
      bidCount: 0,
      microgonsBid: 0n,
    };

    this.global = {
      totalSeats: 0,
      framesMined: 0,
      framesRemaining: 0,
      framedCost: 0n,
      totalMicrogonsBid: 0n,
      totalTransactionFees: 0n,
      totalMicronotsMined: 0n,
      totalMicrogonsMined: 0n,
      totalMicrogonsMinted: 0n,
    };

    this.frames = [];

    this.argonActivity = [];
    this.bitcoinActivity = [];
    this.biddingActivity = [];

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
        microgonsBid: x.microgonsBid,
      };
    });

    const myWinningBids = this.allWinningBids.filter(bid => typeof bid.subAccountIndex === 'number');
    this.myMiningBids.bidCount = myWinningBids.length;
    this.myMiningBids.microgonsBid = myWinningBids.reduce((acc, bid) => acc + (bid.microgonsBid || 0n), 0n);
  }

  private async fetchActiveMiningSeatsFromDb(): Promise<IMyMiningSeats> {
    let seatCount = 0;
    let transactionFees = 0n;
    let microgonsBid = 0n;
    let micronotsStaked = 0n;
    let microgonsMined = 0n;
    let micronotsMined = 0n;
    let microgonsMinted = 0n;
    let microgonsToBeMined = 0n;
    let microgonsToBeMinted = 0n;
    let micronotsToBeMined = 0n;

    const activeCohorts = await this.db.cohortsTable.fetchActiveCohorts(this.latestFrameId);

    for (const cohort of activeCohorts) {
      // Scale factor to preserve precision (cohort.progress has 3 decimal places)
      // factor = (100 - progress) / 100, scaled by 100000 for 3 decimal precision
      const remainingRewardsPerSeat = this.calculateRemainingRewardsExpectedPerSeat(cohort);

      seatCount += cohort.seatsWon;
      microgonsBid += cohort.microgonsBid * BigInt(cohort.seatsWon);
      transactionFees += cohort.transactionFees * BigInt(cohort.seatsWon);
      micronotsStaked += cohort.micronotsStaked * BigInt(cohort.seatsWon);
      microgonsToBeMined += remainingRewardsPerSeat.microgonsToBeMined * BigInt(cohort.seatsWon);
      microgonsToBeMinted += remainingRewardsPerSeat.microgonsToBeMinted * BigInt(cohort.seatsWon);
      micronotsToBeMined += remainingRewardsPerSeat.micronotsToBeMined * BigInt(cohort.seatsWon);
    }

    const activeCohortFrames = await this.db.cohortFramesTable.fetchActiveCohortFrames(this.latestFrameId);

    for (const cohortFrame of activeCohortFrames) {
      microgonsMined += cohortFrame.microgonsMined;
      micronotsMined += cohortFrame.micronotsMined;
      microgonsMinted += cohortFrame.microgonsMinted;
    }

    return {
      seatCount,
      transactionFees,
      microgonsBid,
      micronotsStaked,
      microgonsMined,
      micronotsMined,
      microgonsMinted,
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
    const microgonsExpected = bigIntMax(cohort.microgonsBid, cohort.microgonsToBeMined);
    const microgonsExpectedToBeMinted = microgonsExpected - cohort.microgonsToBeMined;

    const factorBn = BigNumber(100 - cohort.progress).dividedBy(100);

    const microgonsToBeMinedBn = BigNumber(cohort.microgonsToBeMined).multipliedBy(factorBn);
    const micronotsToBeMinedBn = BigNumber(cohort.micronotsToBeMined).multipliedBy(factorBn);
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

  private async fetchFramesFromDb(): Promise<IFramesOverTime[]> {
    const lastYear = await this.db.framesTable.fetchLastYear();
    let maxApr = Math.max(...lastYear.map(x => x.apr));
    maxApr = Math.min(maxApr, 9_999);

    return lastYear
      .map(x => {
        let score = Math.min(x.apr, 9_999);
        if (x.apr > 0) {
          score = (200 * score) / maxApr;
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
      totalSeats: globalStats1.totalSeats,
      framesMined: globalStats1.framesMined,
      framesRemaining: globalStats1.framesRemaining,
      framedCost: globalStats1.framedCost,
      totalMicrogonsBid: globalStats1.totalMicrogonsBid,
      totalTransactionFees: globalStats1.totalTransactionFees,
      totalMicronotsMined: globalStats2.totalMicronotsMined,
      totalMicrogonsMined: globalStats2.totalMicrogonsMined,
      totalMicrogonsMinted: globalStats2.totalMicrogonsMinted,
    };
  }
}
