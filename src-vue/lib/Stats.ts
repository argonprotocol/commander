import { IBidsFile } from '@argonprotocol/commander-bot/src/storage';
import { StatsSyncer } from './StatsSyncer';
import { IDashboardStats } from '../interfaces/IStats';
import { Db } from './Db';
import { Config } from './Config';
import { Installer } from '../stores/installer';
import { SSH } from './SSH';
import { bigIntMax, calculateCurrentFrameIdFromSystemTime } from '@argonprotocol/commander-calculator/src/utils';
import { ICohortRecord } from '../interfaces/db/ICohortRecord';

let IS_INITIALIZED = false;

interface IMiningSeats {
  activeSeats: number;
  microgonsBid: bigint;
  micronotsStaked: bigint;
  microgonsMined: bigint;
  micronotsMined: bigint;
  microgonsMinted: bigint;
  microgonsToBeMined: bigint;
  micronotsToBeMined: bigint;
}

export class Stats {
  public currentFrameId: number;
  public cohortId: number | null;

  public miningSeats: IMiningSeats;
  public dashboard: IDashboardStats;
  public argonActivity: any[];
  public bitcoinActivity: any[];
  public botActivity: any[];

  public winningBids: IBidsFile['winningBids'];
  public myMiningBidCount: number;
  public myMiningBidCost: bigint;

  public maxSeatsPossible: number;
  public maxSeatsReductionReason: string;

  private isLoading: boolean = false;
  private isLoaded: boolean = false;
  private isLoadedPromise: Promise<void>;

  public isReady: boolean;

  public isBotStarting: boolean;
  public isBotSyncing: boolean;
  public isBotBroken: boolean;
  public isBotWaitingForBiddingRules: boolean;

  public syncProgress!: number;
  public syncErrorType!: string | null;

  private loadingFns!: { resolve: () => void; reject: (error: Error) => void };

  private db!: Db;

  private config!: Config;
  private installer!: Installer;
  private dbPromise: Promise<Db>;
  private syncer!: StatsSyncer;

  private static isInitialized: boolean = false;

  constructor(dbPromise: Promise<Db>, config: Config, installer: Installer) {
    if (Stats.isInitialized) {
      console.log(new Error().stack);
      throw new Error('Stats already initialized');
    }
    Stats.isInitialized = true;

    this.isReady = false;
    this.isBotStarting = false;
    this.isBotSyncing = false;
    this.isBotBroken = false;
    this.isBotWaitingForBiddingRules = false;

    this.maxSeatsReductionReason = '';
    this.maxSeatsPossible = 10; // TODO: instead of hardcoded 10, fetch from chain

    this.cohortId = null;
    this.winningBids = [];
    this.myMiningBidCount = 0;
    this.myMiningBidCost = 0n;

    this.currentFrameId = calculateCurrentFrameIdFromSystemTime();

    this.miningSeats = {
      activeSeats: 0,
      microgonsBid: 0n,
      micronotsStaked: 0n,
      microgonsMined: 0n,
      micronotsMined: 0n,
      microgonsMinted: 0n,
      microgonsToBeMined: 0n,
      micronotsToBeMined: 0n,
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
    this.botActivity = [];

    this.dbPromise = dbPromise;
    this.config = config;
    this.installer = installer;

    this.isLoadedPromise = new Promise((resolve, reject) => {
      this.loadingFns = { resolve, reject };
    });
  }

  public async load() {
    if (this.isLoading || this.isLoaded) return;
    this.isLoading = true;

    console.log('Loading stats...');
    console.log('Stats is waiting for config');
    await this.config.isLoadedPromise;
    console.log('Stats is waiting for installer');
    await this.installer.isLoadedPromise;
    this.db = await this.dbPromise;

    while (!this.isRunnable) {
      console.log('Stats is waiting for server to be ready...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.info('LOADING Stats...');
    this.syncer = await new StatsSyncer(this, this.config, this.db);

    this.isLoaded = true;
    this.isLoading = false;
    this.loadingFns.resolve();
  }

  public async start(): Promise<void> {
    await this.isLoadedPromise;
    console.log('STARTING STATS');

    this.syncer.on({
      updateStats: async () => {
        console.log('UPDATING STATS');
        this.cohortId ??= await this.fetchLatestCohortIdFromDb();
        this.dashboard = await this.fetchDashboardFromDb();
        this.miningSeats = await this.fetchMiningSeatsFromDb();
        this.argonActivity = await this.db.argonActivitiesTable.fetchLastFiveRecords();
        this.bitcoinActivity = await this.db.bitcoinActivitiesTable.fetchLastFiveRecords();
        this.botActivity = await this.db.botActivitiesTable.fetchLastFiveRecords();
      },
      refreshCohortData: async (cohortId: number) => {
        if (this.cohortId && this.cohortId !== cohortId) return;
        this.cohortId = cohortId;
        this.dashboard = await this.fetchDashboardFromDb();
      },
      updateWinningBids: async (winningBids: IBidsFile['winningBids']) => {
        this.winningBids = winningBids;
        const myBids = winningBids.filter(bid => bid.subAccountIndex !== undefined);
        this.myMiningBidCount = myBids.length;
        this.myMiningBidCost = myBids.reduce((acc, bid) => acc + (bid.microgonsBid || 0n), 0n);
      },
      updateArgonActivity: async () => {
        this.argonActivity = await this.db.argonActivitiesTable.fetchLastFiveRecords();
      },
      updateBitcoinActivity: async () => {
        this.bitcoinActivity = await this.db.bitcoinActivitiesTable.fetchLastFiveRecords();
      },
      updateBotActivity: async () => {
        this.botActivity = await this.db.botActivitiesTable.fetchLastFiveRecords();
      },
    });
  }

  public async restartBot() {
    await SSH.stopBotDocker();
    await SSH.startBotDocker();
    await new Promise(resolve => setTimeout(resolve, 5_000));
    this.isReady = false;
    this.isBotStarting = false;
    this.isBotSyncing = false;
    this.isBotBroken = false;
    this.isBotWaitingForBiddingRules = false;
    this.syncProgress = 0;
    this.maxSeatsPossible = 10;
    this.maxSeatsReductionReason = '';
    await this.syncer.reload();
  }

  public async stop(): Promise<void> {
    console.log('STOPPING STATS');
    await this.syncer?.off();
  }

  public get isRunnable(): boolean {
    return (
      this.config.isServerReadyToInstall &&
      this.config.isServerUpToDate &&
      this.config.isServerInstalled &&
      !this.config.isWaitingForUpgradeApproval
    );
  }

  private async fetchMiningSeatsFromDb(): Promise<IMiningSeats> {
    let activeSeats = 0;
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

      activeSeats += cohort.seatsWon;
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
      activeSeats,
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
