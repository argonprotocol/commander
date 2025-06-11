import { ISyncState } from '@argonprotocol/commander-bot/src/storage';
import { StatsFetcher } from './stats/Fetcher';
import { StatsSyncer } from './stats/Syncer';
import { IStats, IActiveBids, IDashboardStats } from '../interfaces/IStats';
import { Db } from './Db';
import { Config } from './Config';
import { SSH } from './SSH';
import { Installer } from '../stores/installer';

let IS_INITIALIZED = false;

interface CohortAccount {
  idx: number;
  address: string;
  bidPosition: number;
  argonsBid: number;
}

export class Stats {
  public hasError: boolean = false;
  public isSyncing: boolean = false;
  public syncProgress: number = 0.0;
  public syncError: string | null = null;
  public hasWonSeats: boolean = false;

  public isLoaded: boolean;
  public isLoadedPromise: Promise<void>;

  private _loadingFns!: { resolve: () => void, reject: (error: Error) => void };

  private localPort!: number;
  private botStatus!: ISyncState;
  private oldestFrameIdToSync!: number;
  private currentFrameId!: number;
  private lastProcessedFrameId!: number;
  private isMissingCurrentFrame: boolean = false;
  private db!: Db;

  private _config!: Config;
  private _installer!: Installer;
  private _dbPromise: Promise<Db>;

  private _data: IStats = {
    isSyncing: false,
    syncProgress: 0.0,
    syncError: null,
    hasWonSeats: false,
    activeBids: {
      subaccounts: []
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
        totalArgonsMinted: 0
      },
    },
    argonActivity: [],
    bitcoinActivity: [],
    botActivity: []
  };

  constructor(dbPromise: Promise<Db>, config: Config, installer: Installer) {
    if (IS_INITIALIZED) throw new Error("Stats already initialized");
    IS_INITIALIZED = true;

    this._dbPromise = dbPromise;
    this._config = config;
    this._installer = installer;

    this.isLoadedPromise = new Promise((resolve, reject) => {
      this._loadingFns = { resolve, reject };
    });
    this.isLoaded = false;
  }

  public get isRunnable(): boolean {
      return this._config.isServerInstalling || this._config.isWaitingForUpgradeApproval;
  }

  public async load() {
    await this._installer.isLoadedPromise;
    
    console.info('Loading stats...');
    this.db = await this._dbPromise;
    this.lastProcessedFrameId = (await this.db.framesTable.latestId()) || 0;

    console.info('Ensuring tunnel...');
    this.localPort = await SSH.ensureTunnel(this._config.serverDetails);

    console.info('Fetching bot status...');
    this.botStatus = await StatsFetcher.fetchBotStatus(this.localPort);

    await this.updateServerDetailsFromBotStatus(this.botStatus);
    this.oldestFrameIdToSync = this.botStatus.oldestFrameIdToSync;
    this.currentFrameId = this.botStatus.currentFrameId;
    this.syncProgress = await this.calculateSyncProgress();
    console.info('Sync progress:', this.syncProgress);
    // if (syncProgress < 100.0) {
    //     this.isSyncing = true;
    //     await new StatsSyncer(this.localPort, this.db).run(
    //         this.oldestFrameIdToSync,
    //         this.currentFrameId
    //     );
    // }

    this.isLoaded = true;
    this._loadingFns.resolve();
  }

  public async fetch(cohortId: number | null): Promise<IStats> {
    const syncer = new StatsSyncer(this.localPort, this.db);

    if (this.isMissingCurrentFrame) {
      const yesterdayFrame = await this.db.framesTable.fetchById(this.currentFrameId - 1);
      if (!yesterdayFrame.isProcessed) {
        await syncer.syncDbFrame(yesterdayFrame.id);
      }
    }

    await syncer.syncDbFrame(this.currentFrameId);
    await this.updateArgonActivity();
    try {
      await this.updateBitcoinActivity();
    } catch (e) {
      console.info('Failed to update bitcoin activity:', e);
    }

    const activeBids = await this.fetchActiveBids();
    const finalCohortId = cohortId || await this.fetchLatestCohortId();
    const dashboard = await this.fetchDashboard(finalCohortId);

    return {
      activeBids,
      dashboard,
      argonActivity: await this.db.argonActivitiesTable.fetchLastFiveRecords(),
      bitcoinActivity: await this.db.bitcoinActivitiesTable.fetchLastFiveRecords(),
      botActivity: await this.db.botActivitiesTable.fetchLastFiveRecords()
    };
  }

  private async calculateSyncProgress(): Promise<number> {
    const botLoadProgress = this.botStatus.loadProgress * 0.9;
    console.info('Bot load progress:', botLoadProgress);

    if (botLoadProgress < 90.0) {
      return botLoadProgress;
    }

    const dbSyncProgress = await this.calculateDbSyncProgress() * 0.1;
    console.info('DB sync progress:', dbSyncProgress);
    
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

    if (dbRowsFound === (dbRowsExpected - 1)) {
      try {
        await this.db.framesTable.fetchById(this.currentFrameId);
      } catch {
        this.isMissingCurrentFrame = true;
        return 100.0;
      }
    }

    return (dbRowsFound / dbRowsExpected) * 100.0;
  }

  private async fetchActiveBids(): Promise<IActiveBids> {
    const cohortAccounts = await this.db.cohortAccountsTable.fetchForCohortId(this.currentFrameId);
    return {
      subaccounts: cohortAccounts.map((account: CohortAccount) => ({
        index: account.idx,
        address: account.address,
        bidPosition: account.bidPosition,
        argonsBid: account.argonsBid,
        isRebid: null,
        lastBidAtTick: null
      }))
    };
  }

  public async fetchDashboard(cohortId: number | null): Promise<IDashboardStats> {
    return {
      global: await this.fetchDashboardGlobalStats(),
      cohortId,
      cohort: cohortId ? await this.fetchDashboardCohortStats(cohortId) : null
    };
  }

  private async fetchLatestCohortId(): Promise<number | null> {
    try {
      const id = await this.db.cohortsTable.fetchLatestActiveId();
      return id || null;
    } catch {
      return null;
    }
  }

  private async fetchDashboardGlobalStats() {
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
      totalArgonsMinted: globalStats2.totalArgonsMinted
    };
  }

  private async fetchDashboardCohortStats(cohortId: number) {
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
      argonsMinted: cohortStats.totalArgonsMinted
    };
  }

  private async updateServerDetailsFromBotStatus(botStatus: ISyncState): Promise<void> {
    if (botStatus.oldestFrameIdToSync > 0) {
      this._config.serverDetails.oldestFrameIdToSync = botStatus.oldestFrameIdToSync;
    }

    this._config.hasMiningSeats = botStatus.hasWonSeats;
    await this._config.save();
  }

  private async updateArgonActivity(): Promise<void> {
    const latestBlockNumbers = await StatsFetcher.fetchArgonBlockchainStatus(this.localPort);
    const lastArgonActivity = await this.db.argonActivitiesTable.latest();
    
    const localhostMatches = lastArgonActivity?.localNodeBlockNumber === latestBlockNumbers.localNode;
    const mainchainMatches = lastArgonActivity?.mainNodeBlockNumber === latestBlockNumbers.mainNode;
    
    if (!localhostMatches || !mainchainMatches) {
      await this.db.argonActivitiesTable.insert(latestBlockNumbers.localNode, latestBlockNumbers.mainNode);
    }
  }

  private async updateBitcoinActivity(): Promise<void> {
    const latestBlockNumbers = await StatsFetcher.fetchBitcoinBlockchainStatus(this.localPort);
    const savedActivity = await this.db.bitcoinActivitiesTable.latest();
    
    const localhostMatches = savedActivity?.localNodeBlockNumber === latestBlockNumbers.localNode;
    const mainchainMatches = savedActivity?.mainNodeBlockNumber === latestBlockNumbers.mainNode;
    
    if (!localhostMatches || !mainchainMatches) {
      await this.db.bitcoinActivitiesTable.insert(latestBlockNumbers.localNode, latestBlockNumbers.mainNode);
    }
  }

  private async updateBotActivity(): Promise<void> {
    const botHistory = await StatsFetcher.fetchBotHistory(this.localPort);
    // TODO: Implement bot activity update logic
  }
} 