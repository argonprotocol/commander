import { IBidsFile, ISyncState } from '@argonprotocol/commander-bot/src/storage';
import { StatsFetcher } from './stats/Fetcher';
import { StatsSyncer } from './stats/Syncer';
import { IStats, IActiveBids, IDashboardStats } from '../interfaces/IStats';
import { Db } from './Db';
import { Config } from './Config';
import { SSH } from './SSH';
import { Installer } from '../stores/installer';
import { getMainchainClient } from '../stores/mainchain';
import { MiningFrames } from '@argonprotocol/commander-bot/src/MiningFrames';

let IS_INITIALIZED = false;

interface CohortAccount {
  idx: number;
  address: string;
  bidPosition: number;
  argonsBid: number;
}

export class Stats {
  public cohortId: number | null;

  public dashboard: IDashboardStats;
  public argonActivity: any[];
  public bitcoinActivity: any[];
  public botActivity: any[];

  public winningBids: IBidsFile['winningBids'];

  public maxSeatsPossible: number;
  public maxSeatsReductionReason: string;

  public isLoaded: boolean;
  public isLoadedPromise: Promise<void>;
  public isRunning: boolean;

  private _loadingFns!: { resolve: () => void; reject: (error: Error) => void };

  private syncState!: ISyncState;
  private db!: Db;

  private _config!: Config;
  private _installer!: Installer;
  private _dbPromise: Promise<Db>;

  constructor(dbPromise: Promise<Db>, config: Config, installer: Installer) {
    if (IS_INITIALIZED) {
      console.log(new Error().stack);
      throw new Error('Stats already initialized');
    }
    IS_INITIALIZED = true;

    this.isLoaded = false;
    this.isRunning = false;
    this.maxSeatsReductionReason = '';
    this.maxSeatsPossible = 10; // TODO: instead of hardcoded 10, fetch from chain
    this.cohortId = null;
    this.winningBids = [];
    this.dashboard = {
      cohortId: null,
      cohort: null,
      global: {
        activeCohorts: 0,
        activeSeats: 0,
        totalBlocksMined: 0,
        totalArgonsBid: 0,
        totalTransactionFees: 0,
        totalArgonotsMined: 0,
        totalArgonsMined: 0,
        totalArgonsMinted: 0,
      },
    };
    this.argonActivity = [];
    this.bitcoinActivity = [];
    this.botActivity = [];

    this._dbPromise = dbPromise;
    this._config = config;
    this._installer = installer;

    this.isLoadedPromise = new Promise((resolve, reject) => {
      this._loadingFns = { resolve, reject };
    });
  }

  public async load() {
    await this._installer.isLoadedPromise;

    while (!this.isRunnable) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.info('Loading stats...', { isServerInstalling: this._config.isServerInstalling });
    this.db = await this._dbPromise;

    console.info('Ensuring tunnel...');
    this.localPort = await SSH.ensureTunnel(this._config.serverDetails);
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.info('Fetching sync state...');
    await this.updateSyncState();

    console.info('Trying to sync state...');
    const syncer = await new StatsSyncer(this.localPort, this._config, this.db);
    await syncer.sync(this.syncState);

    this.run(syncer);

    this.isLoaded = true;
    this._loadingFns.resolve();
  }

  private async run(syncer: StatsSyncer): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    while (!this.isRunnable) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('RUNNING STATS');
    this.cohortId ??= await this.fetchLatestCohortIdFromDb();

    await this.updateSyncState();
    const currentFrameId = this.syncState.currentFrameId;
    const activeBidsFile = await StatsFetcher.fetchBidsFile(this.localPort);
    this.winningBids = activeBidsFile.winningBids;

    try {
      await syncer.syncDbFrame(currentFrameId);
    } catch (e) {
      console.info('Failed to sync db frame:', e);
    }

    if (syncer.isMissingCurrentFrame) {
      const yesterdayFrameId = currentFrameId - 1;
      const yesterdayFrame = await this.db.framesTable.fetchById(yesterdayFrameId);
      if (!yesterdayFrame?.isProcessed) {
        await syncer.syncDbFrame(yesterdayFrameId);
      }
    }

    await this.updateArgonActivity();
    await this.updateBitcoinActivity();

    this.dashboard = await this.fetchDashboardFromDb();
    this.argonActivity = await this.db.argonActivitiesTable.fetchLastFiveRecords();
    this.bitcoinActivity = await this.db.bitcoinActivitiesTable.fetchLastFiveRecords();
    this.botActivity = await this.db.botActivitiesTable.fetchLastFiveRecords();

    this.isRunning = false;
    setTimeout(() => {
      this.run(syncer);
    }, 1e3);
  }

  private get isRunnable(): boolean {
    return !this._config.isServerInstalling && !this._config.isWaitingForUpgradeApproval;
  }

  public async fetchDashboardFromDb(): Promise<IDashboardStats> {
    return {
      global: await this.fetchDashboardGlobalStatsFromDb(),
      cohortId: this.cohortId,
      cohort: this.cohortId ? await this.fetchDashboardCohortStatsFromDb(this.cohortId) : null,
    };
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
      totalArgonsBid: globalStats1.totalArgonsBid,
      totalTransactionFees: globalStats1.totalTransactionFees,
      totalArgonotsMined: globalStats2.totalArgonotsMined,
      totalArgonsMined: globalStats2.totalArgonsMined,
      totalArgonsMinted: globalStats2.totalArgonsMinted,
    };
  }

  private async fetchDashboardCohortStatsFromDb(
    cohortId: number,
  ): Promise<IDashboardStats['cohort']> {
    const cohort = await this.db.cohortsTable.fetchById(cohortId);
    if (!cohort) return null;

    const cohortStats = await this.db.cohortFramesTable.fetchCohortStats(cohort.id);

    return {
      cohortId: cohort.id,
      firstTick: cohort.firstTick,
      lastTick: cohort.lastTick,
      lastBlockNumber: cohort.lastBlockNumber,
      transactionFees: cohort.transactionFees,
      argonotsStaked: cohort.argonotsStaked,
      argonsBid: cohort.argonsBid,
      seatsWon: cohort.seatsWon,
      progress: cohort.progress,
      blocksMined: cohortStats.totalBlocksMined,
      argonotsMined: cohortStats.totalArgonotsMined,
      argonsMined: cohortStats.totalArgonsMined,
      argonsMinted: cohortStats.totalArgonsMinted,
    };
  }

  private async updateSyncState(): Promise<void> {
    this.syncState = await StatsFetcher.fetchSyncState(this.localPort);
    this.maxSeatsReductionReason = this.syncState.maxSeatsReductionReason;
    this.maxSeatsPossible = this.syncState.maxSeatsPossible;

    if (this.syncState.oldestFrameIdToSync > 0) {
      this._config.serverDetails.oldestFrameIdToSync = this.syncState.oldestFrameIdToSync;
    }

    this._config.hasMiningSeats = this.syncState.hasMiningSeats;
    this._config.hasMiningBids = this.syncState.hasMiningBids;

    await this._config.save();
  }

  private async updateArgonActivity(): Promise<void> {
    const latestBlockNumbers = this.syncState.argonBlockNumbers;
    const lastArgonActivity = await this.db.argonActivitiesTable.latest();

    const localhostMatches =
      lastArgonActivity?.localNodeBlockNumber === latestBlockNumbers.localNode;
    const mainchainMatches = lastArgonActivity?.mainNodeBlockNumber === latestBlockNumbers.mainNode;

    if (!localhostMatches || !mainchainMatches) {
      await this.db.argonActivitiesTable.insert(
        latestBlockNumbers.localNode,
        latestBlockNumbers.mainNode,
      );
    }
  }

  private async updateBitcoinActivity(): Promise<void> {
    const latestBlockNumbers = this.syncState.bitcoinBlockNumbers;
    const savedActivity = await this.db.bitcoinActivitiesTable.latest();

    const localhostMatches = savedActivity?.localNodeBlockNumber === latestBlockNumbers.localNode;
    const mainchainMatches = savedActivity?.mainNodeBlockNumber === latestBlockNumbers.mainNode;

    if (!localhostMatches || !mainchainMatches) {
      await this.db.bitcoinActivitiesTable.insert(
        latestBlockNumbers.localNode,
        latestBlockNumbers.mainNode,
      );
    }
  }

  private async updateBotActivity(): Promise<void> {
    const botHistory = await StatsFetcher.fetchBotHistory(this.localPort);
    // TODO: Implement bot activity update logic
  }
}
			