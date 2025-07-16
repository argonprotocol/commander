import { IBidsFile } from '@argonprotocol/commander-bot/src/storage';
import { IDashboardStats } from '../interfaces/IStats';
import { Db } from './Db';
import { Config } from './Config';
import { bigIntMax, calculateCurrentFrameIdFromSystemTime } from '@argonprotocol/commander-calculator/src/utils';
import { ICohortRecord } from '../interfaces/db/ICohortRecord';
import { botEmitter } from './Bot';
import { createPromiser, ensureOnlyOneInstance } from './Utils';
import ICreatePromiser from '../interfaces/ICreatePromiser';

interface IMyMiningSeats {
  seatCount: number;
  microgonsBid: bigint;
  micronotsStaked: bigint;
  microgonsMined: bigint;
  micronotsMined: bigint;
  microgonsMinted: bigint;
  microgonsToBeMined: bigint;
  micronotsToBeMined: bigint;
}

interface IMyMiningBids {
  bidCount: number;
  microgonsBid: bigint;
}

export class Stats {
  public currentFrameId: number;
  public cohortId: number | null;

  public myMiningSeats: IMyMiningSeats;
  public myMiningBids: IMyMiningBids;

  public allWinningBids: IBidsFile['winningBids'];

  public dashboard: IDashboardStats;
  public argonActivity: any[];
  public bitcoinActivity: any[];
  public biddingActivity: any[];

  public isLoaded: boolean;
  public isLoadedPromise: Promise<void>;

  private isLoading: boolean = false;
  private loadedPromiser!: ICreatePromiser<void>;

  private listeningCounter: number = 0;

  private db!: Db;

  private config!: Config;
  private dbPromise: Promise<Db>;

  constructor(dbPromise: Promise<Db>, config: Config) {
    ensureOnlyOneInstance(this.constructor);

    this.isLoaded = false;

    this.cohortId = null;
    this.allWinningBids = [];

    this.currentFrameId = calculateCurrentFrameIdFromSystemTime();

    this.myMiningSeats = {
      seatCount: 0,
      microgonsBid: 0n,
      micronotsStaked: 0n,
      microgonsMined: 0n,
      micronotsMined: 0n,
      microgonsMinted: 0n,
      microgonsToBeMined: 0n,
      micronotsToBeMined: 0n,
    };

    this.myMiningBids = {
      bidCount: 0,
      microgonsBid: 0n,
    };

    this.dashboard = {
      cohortId: null,
      cohort: null,
      global: {
        activeCohorts: 0,
        activeSeats: 0,
        totalBlocksMined: 0,
        totalMicrogonsBid: 0n,
        totalTransactionFees: 0n,
        totalMicronotsMined: 0n,
        totalMicrogonsMined: 0n,
        totalMicrogonsMinted: 0n,
      },
    };

    this.argonActivity = [];
    this.bitcoinActivity = [];
    this.biddingActivity = [];

    this.dbPromise = dbPromise;
    this.config = config;

    this.loadedPromiser = createPromiser<void>();
    this.isLoadedPromise = this.loadedPromiser.promise;
  }

  public async load() {
    if (this.isLoading || this.isLoaded) return;
    this.isLoading = true;

    await this.config.isLoadedPromise;
    this.db = await this.dbPromise;

    botEmitter.on('updated-cohort-data', async (cohortId: number) => {
      if (!this.isActive()) return;

      if (this.cohortId && this.cohortId !== cohortId) return;
      this.cohortId = cohortId;

      await this.updateDashboard();
      await this.updateMiningSeats();
      await this.updateBitcoinActivity();
      await this.updateArgonActivity();
      await this.updateBiddingActivity();
    });

    botEmitter.on('updated-bids-data', async (allWinningBids: IBidsFile['winningBids']) => {
      if (!this.isActive()) return;
      this.updateBiddingData(allWinningBids);
    });

    botEmitter.on('updated-bitcoin-activity', async () => {
      if (!this.isActive()) return;
      this.updateBitcoinActivity();
    });

    botEmitter.on('updated-argon-activity', async () => {
      if (!this.isActive()) return;
      this.updateArgonActivity();
    });

    botEmitter.on('updated-bidding-activity', async () => {
      if (!this.isActive()) return;
      this.updateBiddingActivity();
    });

    await this.updateMiningSeats();
    await this.updateBitcoinActivity();
    await this.updateArgonActivity();
    await this.updateBiddingActivity();

    this.isLoaded = true;
    this.isLoading = false;
    this.loadedPromiser.resolve();
  }

  public async start(): Promise<void> {
    this.listeningCounter++;
    if (this.listeningCounter > 1) return;

    this.cohortId ??= await this.fetchLatestCohortIdFromDb();
    if (!this.cohortId) return;

    await this.loadedPromiser.promise;
    await Promise.all([
      this.updateDashboard(),
      this.updateMiningSeats(),
      this.updateBitcoinActivity(),
      this.updateArgonActivity(),
      this.updateBiddingActivity(),
      this.updateBiddingData(this.allWinningBids),
      this.updateBitcoinActivity(),
      this.updateArgonActivity(),
      this.updateBiddingActivity(),
    ]);
  }

  public async stop(): Promise<void> {
    this.listeningCounter--;
  }

  public isActive(): boolean {
    return this.listeningCounter > 0;
  }

  private async updateDashboard(): Promise<void> {
    this.dashboard = await this.fetchDashboardFromDb();
  }

  private async updateMiningSeats(): Promise<void> {
    this.myMiningSeats = await this.fetchMiningSeatsFromDb();
  }

  private async updateBitcoinActivity(): Promise<void> {
    this.bitcoinActivity = await this.db.bitcoinActivitiesTable.fetchLastFiveRecords();
  }

  private async updateArgonActivity(): Promise<void> {
    this.argonActivity = await this.db.argonActivitiesTable.fetchLastFiveRecords();
  }

  private async updateBiddingActivity(): Promise<void> {
    this.biddingActivity = await this.db.botActivitiesTable.fetchLastFiveRecords();
  }

  private async updateBiddingData(allWinningBids: IBidsFile['winningBids']): Promise<void> {
    this.allWinningBids = allWinningBids;
    const myWinningBids = allWinningBids.filter(bid => bid.subAccountIndex !== undefined);
    this.myMiningBids.bidCount = myWinningBids.length;
    this.myMiningBids.microgonsBid = myWinningBids.reduce((acc, bid) => acc + (bid.microgonsBid || 0n), 0n);
  }

  private async fetchMiningSeatsFromDb(): Promise<IMyMiningSeats> {
    let seatCount = 0;
    let microgonsBid = 0n;
    let micronotsStaked = 0n;
    let microgonsMined = 0n;
    let micronotsMined = 0n;
    let microgonsMinted = 0n;
    let microgonsToBeMined = 0n;
    let micronotsToBeMined = 0n;

    const activeCohorts = await this.db.cohortsTable.fetchActiveCohorts(this.currentFrameId);

    for (const cohort of activeCohorts) {
      // Scale factor to preserve precision (cohort.progress has 3 decimal places)
      // factor = (100 - progress) / 100, scaled by 100000 for 3 decimal precision
      const remainingRewards = this.calculateRemainingRewardsToBeMined(cohort);

      seatCount += cohort.seatsWon;
      microgonsBid += cohort.microgonsBid * BigInt(cohort.seatsWon);
      micronotsStaked += cohort.micronotsStaked * BigInt(cohort.seatsWon);
      microgonsToBeMined += remainingRewards.microgons * BigInt(cohort.seatsWon);
      micronotsToBeMined += remainingRewards.micronots * BigInt(cohort.seatsWon);
    }

    const activeCohortFrames = await this.db.cohortFramesTable.fetchActiveCohortFrames(this.currentFrameId);

    for (const cohortFrame of activeCohortFrames) {
      microgonsMined += cohortFrame.microgonsMined;
      micronotsMined += cohortFrame.micronotsMined;
      microgonsMinted += cohortFrame.microgonsMinted;
    }

    return {
      seatCount,
      microgonsBid,
      micronotsStaked,
      microgonsMined,
      micronotsMined,
      microgonsMinted,
      microgonsToBeMined,
      micronotsToBeMined,
    };
  }

  private calculateRemainingRewardsToBeMined(cohort: ICohortRecord): { microgons: bigint; micronots: bigint } {
    const baseMicrogons = bigIntMax(cohort.microgonsBid, cohort.microgonsToBeMined);
    const extraMicrogons = cohort.microgonsToBeMined - baseMicrogons;

    const factorNumerator = BigInt(Math.floor((100 - cohort.progress) * 1_000));
    const factorDenominator = 100_000n;

    const microgonsToBeMinedPerSeat = (cohort.microgonsToBeMined * factorNumerator) / factorDenominator;
    const micronotsToBeMinedPerSeat = (cohort.micronotsToBeMined * factorNumerator) / factorDenominator;

    return {
      microgons: microgonsToBeMinedPerSeat,
      micronots: micronotsToBeMinedPerSeat,
    };
  }

  private async fetchDashboardFromDb(): Promise<IDashboardStats> {
    try {
      return {
        global: await this.fetchDashboardGlobalStatsFromDb(),
        cohortId: this.cohortId,
        cohort: this.cohortId ? await this.fetchDashboardCohortStatsFromDb(this.cohortId) : null,
      };
    } catch (error) {
      console.error('Error fetching dashboard from db', error);
      throw error;
    }
  }

  private async fetchLatestCohortIdFromDb(): Promise<number | null> {
    try {
      const id = await this.db.cohortsTable.fetchLatestActiveId();
      return id || null;
    } catch {
      return null;
    }
  }

  private async fetchDashboardGlobalStatsFromDb(): Promise<IDashboardStats['global']> {
    const currentFrameId = await this.db.framesTable.latestId();
    const globalStats1 = await this.db.cohortsTable.fetchGlobalStats(currentFrameId);
    const globalStats2 = await this.db.cohortFramesTable.fetchGlobalStats();

    return {
      activeCohorts: globalStats1.totalActiveCohorts,
      activeSeats: globalStats1.totalActiveSeats,
      totalBlocksMined: globalStats2.totalBlocksMined,
      totalMicrogonsBid: globalStats1.totalMicrogonsBid,
      totalTransactionFees: globalStats1.totalTransactionFees,
      totalMicronotsMined: globalStats2.totalMicronotsMined,
      totalMicrogonsMined: globalStats2.totalMicrogonsMined,
      totalMicrogonsMinted: globalStats2.totalMicrogonsMinted,
    };
  }

  private async fetchDashboardCohortStatsFromDb(cohortId: number): Promise<IDashboardStats['cohort']> {
    const cohort = await this.db.cohortsTable.fetchById(cohortId);
    if (!cohort) return null;

    const cohortStats = await this.db.cohortFramesTable.fetchCohortStats(cohort.id);

    return {
      cohortId: cohort.id,
      firstTick: cohort.firstTick,
      lastTick: cohort.lastTick,
      lastBlockNumber: cohort.lastBlockNumber,
      transactionFees: cohort.transactionFees,
      micronotsStaked: cohort.micronotsStaked,
      microgonsBid: cohort.microgonsBid,
      seatsWon: cohort.seatsWon,
      progress: cohort.progress,
      blocksMined: cohortStats.totalBlocksMined,
      micronotsMined: cohortStats.totalMicronotsMined,
      microgonsMined: cohortStats.totalMicrogonsMined,
      microgonsMinted: cohortStats.totalMicrogonsMinted,
    };
  }
}
