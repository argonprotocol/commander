import { ISyncState } from '@argonprotocol/commander-bot/src/storage';
import { StatsFetcher } from './stats/Fetcher';
import { StatsSyncer } from './stats/Syncer';
import { IActiveBids, IDashboardStats, IStats } from '../interfaces/IStats';
import { Db } from './Db';
import { Config } from './Config';
import { Installer } from '../stores/installer';

let IS_INITIALIZED = false;

interface CohortAccount {
  idx: number;
  address: string;
  bidPosition: number;
  argonsBid: number;
}

export class Stats {
  public hasMiningSeats: boolean;
  public cohortId: number | null;
  public data: IStats;

  public isLoaded: boolean;
  public isLoadedPromise: Promise<void>;

  private _loadingFns!: { resolve: () => void; reject: (error: Error) => void };

  private syncState!: ISyncState;
  private oldestFrameIdToSync!: number;
  private currentFrameId!: number;
  private lastProcessedFrameId!: number;
  private isMissingCurrentFrame: boolean = false;
  private db!: Db;

  private _config!: Config;
  private _installer!: Installer;
  private _dbPromise: Promise<Db>;

  constructor(dbPromise: Promise<Db>, config: Config, installer: Installer) {
    if (IS_INITIALIZED) throw new Error('Stats already initialized');
    IS_INITIALIZED = true;

    this._dbPromise = dbPromise;
    this._config = config;
    this._installer = installer;

    this.isLoadedPromise = new Promise((resolve, reject) => {
      this._loadingFns = { resolve, reject };
    });
    this.isLoaded = false;
    this.hasMiningSeats = false;
    this.cohortId = null;
    this.data = {
      activeBids: {
        subaccounts: [],
      },
      dashboard: {
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
      },
      argonActivity: [],
      bitcoinActivity: [],
      botActivity: [],
    };
  }

  public async load() {
    await this._installer.isLoadedPromise;

    while (!this.isRunnable) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.info('Loading stats...', { isServerInstalling: this._config.isServerInstalling });
    this.db = await this._dbPromise;
    this.lastProcessedFrameId = (await this.db.framesTable.latestId()) || 0;

    console.info('Fetching sync state...');
    this.syncState = await StatsFetcher.fetchSyncState();

    await this.updateServerDetailsFromSyncState(this.syncState);
    this.oldestFrameIdToSync = this.syncState.oldestFrameIdToSync;
    this.currentFrameId = this.syncState.currentFrameId;

    const syncProgress = await this.calculateSyncProgress();

    this._config.syncDetails = {
      startDate: new Date().toISOString(),
      progress: syncProgress,
      errorType: null,
      errorMessage: null,
    };
    await this._config.save();

    if (syncProgress < 100.0) {
      console.info('TODO: SYNC DATABASE...');
      // await new StatsSyncer(this.localPort, this.db).run(
      //     this.oldestFrameIdToSync,
      //     this.currentFrameId
      // );
    } else {
      this.run();
    }

    this.isLoaded = true;
    this._loadingFns.resolve();
  }

  public async run(): Promise<IStats> {
    this.cohortId ??= await this.fetchLatestCohortIdFromDb();
    const syncer = new StatsSyncer(this.db);

    const bidsFile = await StatsFetcher.fetchBidsFile(this.currentFrameId + 1);
    console.info('CURRENT Bids file:', bidsFile);

    if (this.isMissingCurrentFrame) {
      const yesterdayFrame = await this.db.framesTable.fetchById(this.currentFrameId - 1);
      if (!yesterdayFrame.isProcessed) {
        await syncer.syncDbFrame(yesterdayFrame.id);
      }
    }
    try {
      await syncer.syncDbFrame(this.currentFrameId);
    } catch (e) {
      console.info('Failed to sync db frame:', e);
    }
    // await this.updateArgonActivity();
    // try {
    //   await this.updateBitcoinActivity();
    // } catch (e) {
    //   console.info('Failed to update bitcoin activity:', e);
    // }

    const activeBids = await this.fetchActiveBidsFromDb();
    const dashboard = await this.fetchDashboardFromDb();

    return {
      activeBids,
      dashboard,
      argonActivity: await this.db.argonActivitiesTable.fetchLastFiveRecords(),
      bitcoinActivity: await this.db.bitcoinActivitiesTable.fetchLastFiveRecords(),
      botActivity: await this.db.botActivitiesTable.fetchLastFiveRecords(),
    };
  }

  private get isRunnable(): boolean {
    return !this._config.isServerInstalling && !this._config.isWaitingForUpgradeApproval;
  }

  private async calculateSyncProgress(): Promise<number> {
    const botLoadProgress = this.syncState.loadProgress * 0.9;

    if (botLoadProgress < 90.0) {
      return botLoadProgress;
    }

    const dbSyncProgress = (await this.calculateDbSyncProgress()) * 0.1;

    return botLoadProgress + dbSyncProgress;
  }

  private async calculateDbSyncProgress(): Promise<number> {
    const dbRowsExpected = this.currentFrameId - this.oldestFrameIdToSync + 1;
    const dbRowsFound = await this.db.framesTable.fetchRecordCount();

    if (dbRowsFound === dbRowsExpected) {
      this.lastProcessedFrameId = this.currentFrameId - 1;
      this.isMissingCurrentFrame = false;
      return 100.0;
    }

    if (dbRowsFound === dbRowsExpected - 1) {
      try {
        await this.db.framesTable.fetchById(this.currentFrameId);
      } catch {
        this.isMissingCurrentFrame = true;
        return 100.0;
      }
    }

    return (dbRowsFound / dbRowsExpected) * 100.0;
  }

  private async fetchActiveBidsFromDb(): Promise<IActiveBids> {
    const cohortAccounts = await this.db.cohortAccountsTable.fetchForCohortId(this.currentFrameId);
    return {
      subaccounts: cohortAccounts.map((account: CohortAccount) => ({
        index: account.idx,
        address: account.address,
        bidPosition: account.bidPosition,
        argonsBid: account.argonsBid,
        isRebid: null,
        lastBidAtTick: null,
      })),
    };
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
      frameTickStart: cohort.frameTickStart,
      frameTickEnd: cohort.frameTickEnd,
      transactionFees: cohort.transactionFees,
      argonotsStaked: cohort.argonotsStaked,
      argonsBid: cohort.argonsBid,
      seatsWon: cohort.seatsWon,
      blocksMined: cohortStats.totalBlocksMined,
      argonotsMined: cohortStats.totalArgonotsMined,
      argonsMined: cohortStats.totalArgonsMined,
      argonsMinted: cohortStats.totalArgonsMinted,
    };
  }

  private async updateServerDetailsFromSyncState(syncState: ISyncState): Promise<void> {
    if (syncState.oldestFrameIdToSync > 0) {
      this._config.serverDetails.oldestFrameIdToSync = syncState.oldestFrameIdToSync;
    }

    this._config.hasMiningSeats = syncState.hasMiningSeats;
    await this._config.save();
  }

  private async updateArgonActivity(): Promise<void> {
    const latestBlockNumbers = await StatsFetcher.fetchArgonBlockchainStatus();
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
    const latestBlockNumbers = await StatsFetcher.fetchBitcoinBlockchainStatus();
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
    const botHistory = await StatsFetcher.fetchBotHistory();
    // TODO: Implement bot activity update logic
  }
}
