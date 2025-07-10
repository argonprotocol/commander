import { Config } from './Config';
import { Db } from './Db';
import { StatsFetcher, BotNotReadyError } from './StatsFetcher';
import {
  IBidsFile,
  IEarningsFileCohort,
  ISyncState,
  ISyncStateStarting,
} from '@argonprotocol/commander-bot/src/storage';
import { MiningFrames, TICKS_PER_COHORT } from '@argonprotocol/commander-calculator';
import { Stats } from './Stats';
import { getMainchain } from '../stores/mainchain';

interface IFnByKey {
  updateStats?: () => void;
  updateWinningBids?: (winningBids: IBidsFile['winningBids']) => void;
  refreshCohortData?: (cohortId: number) => void;
  updateArgonActivity?: () => void | Promise<void>;
  updateBitcoinActivity?: () => void | Promise<void>;
  updateBotActivity?: () => void | Promise<void>;
}

export class StatsSyncer {
  public isMissingCurrentFrame: boolean = false;

  private stats: Stats;
  private db: Db;
  private config: Config;
  private syncState!: ISyncState;

  public isLoading: boolean = false;
  public isLoadedPromise: Promise<void>;

  private isSyncingThePast: boolean = false;

  public maxSeatsPossible: number = 10;
  public maxSeatsReductionReason: string = '';

  private fnByKey: IFnByKey = {};
  private miningFrames = new MiningFrames();
  private mainchain = getMainchain();

  constructor(stats: Stats, config: Config, db: Db) {
    this.stats = stats;
    this.config = config;
    this.db = db;

    this.isLoadedPromise = this.load().catch(e => {
      console.error('Failed to load syncer:', e);
    });
  }

  private async load(): Promise<void> {
    if (this.isLoading) {
      throw new Error('Syncer is already loading');
    }
    this.isLoading = true;

    await this.updateSyncState();

    this.isLoading = false;

    if (this.stats.isBotBroken || this.stats.isBotWaitingForBiddingRules) {
      this.stats.isReady = false;
      return;
    }

    this.stats.isReady = true;
    this.continuousUpdate().catch(e => {
      console.error('Failed to update syncer:', e);
    });
  }

  public async reload() {
    this.isLoading = false;
    this.isSyncingThePast = false;
    this.stats.syncProgress = 0;
    this.maxSeatsPossible = 10;
    this.maxSeatsReductionReason = '';
    await this.load();
  }

  public async on(fnByKey: IFnByKey) {
    this.fnByKey = fnByKey;
    if (this.stats.isReady) {
      this.fnByKey.updateStats?.();
    }
  }

  public async off() {
    this.fnByKey = {};
  }

  private async continuousUpdate() {
    if (!this.stats.isReady) {
      console.log('Bot is broken or waiting for bidding rules, giving up...');
      return;
    }

    await this.updateSyncState();
    await this.updateArgonActivity();
    await this.updateBitcoinActivity();
    await this.updateWinningBids();
    setTimeout(this.continuousUpdate.bind(this), 1000);
  }

  private async updateWinningBids() {
    const activeBidsFile = await StatsFetcher.fetchBidsFile();
    this.fnByKey.updateWinningBids?.(activeBidsFile.winningBids);
  }

  private async updateSyncState(retries: number = 0): Promise<void> {
    while (!this.stats.isRunnable) {
      console.log('Waiting for Stats to be runnable...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    try {
      this.syncState = await StatsFetcher.fetchSyncState();
    } catch (e) {
      const isBotNotReadyError = e instanceof BotNotReadyError;
      const isUnknownError = !isBotNotReadyError;
      const syncStateStarting = (e as any).data || ({} as ISyncStateStarting);

      if (isUnknownError && !syncStateStarting.isWaitingForBiddingRules) {
        this.stats.isBotBroken = true;
        this.stopSyncing();
        return;
      }

      if (!this.stats.isBotStarting) {
        console.log('Bot is starting, waiting for it to be ready');
        this.stats.isBotStarting = true;
      }

      if (syncStateStarting.isSyncing) {
        const progress = await this.calculateSyncProgress(syncStateStarting);
        this.stats.isBotSyncing = true;
        this.stats.syncProgress = progress;
      }

      if (syncStateStarting.isWaitingForBiddingRules) {
        this.stats.isBotWaitingForBiddingRules = true;
        this.stopSyncing();
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      return this.updateSyncState();
    }

    this.maxSeatsReductionReason = this.syncState.maxSeatsReductionReason;
    this.maxSeatsPossible = this.syncState.maxSeatsPossible;

    if (this.syncState.oldestFrameIdToSync > 0) {
      this.config.oldestFrameIdToSync = this.syncState.oldestFrameIdToSync;
    }

    this.config.hasMiningSeats = this.syncState.hasMiningSeats;
    this.config.hasMiningBids = this.syncState.hasMiningBids;

    await this.config.save();

    let progress = await this.calculateSyncProgress(this.syncState);

    if (progress < 100.0) {
      progress = await this.syncThePast(progress);
    }

    if (progress < 100.0) {
      this.stats.isBotSyncing = true;
      this.stats.syncProgress = progress;
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await this.updateSyncState();
    }

    this.stats.isBotStarting = false;
    this.stopSyncing();

    if (this.isLoading) {
      this.fnByKey.updateStats?.();
    } else {
      this.fnByKey.refreshCohortData?.(this.syncState.currentFrameId);
    }
  }

  private async stopSyncing() {
    if (this.stats.isBotSyncing) {
      this.stats.isBotSyncing = false;
      this.stats.syncProgress = 100;
    }
  }

  private async syncThePast(progress: number): Promise<number> {
    if (this.isSyncingThePast) return progress;
    this.isSyncingThePast = true;

    const oldestFrameIdToSync = this.syncState.oldestFrameIdToSync;
    const currentFrameId = this.syncState.currentFrameId;
    const framesToSync = currentFrameId - oldestFrameIdToSync + 1;
    console.log('FRAMES TO SYNC', framesToSync, oldestFrameIdToSync, currentFrameId);
    const promise = new Promise<number>(async resolve => {
      for (let frameId = oldestFrameIdToSync; frameId <= currentFrameId; frameId++) {
        console.log(`Syncing frame ${frameId}`);
        await this.syncDbFrame(frameId);
        progress = await this.calculateSyncProgress(this.syncState);
      }

      resolve(progress);
    });

    if (framesToSync < 2) {
      await promise;
    }

    return progress;
  }

  public async syncDbFrame(frameId: number): Promise<void> {
    try {
      const frame = await this.db.framesTable.fetchById(frameId);
      if (frame.isProcessed) {
        return;
      }
    } catch (error) {
      console.log('Frame not found:', frameId);
    }

    const earningsFile = await StatsFetcher.fetchEarningsFile(frameId);

    await this.db.framesTable.insertOrUpdate(
      frameId,
      earningsFile.firstTick,
      earningsFile.lastTick,
      earningsFile.firstBlockNumber,
      earningsFile.lastBlockNumber,
      earningsFile.microgonToUsd,
      earningsFile.microgonToBtc,
      earningsFile.microgonToArgonot,
      earningsFile.frameProgress,
      false,
    );

    const processedCohorts: Set<number> = new Set();
    let totalBlocksMined = 0;

    const cohortsById = Object.entries(earningsFile.byCohortActivatingFrameId) as [string, IEarningsFileCohort][];

    for (const [cohortActivatingFrameIdStr, cohortData] of cohortsById) {
      const cohortActivatingFrameId = parseInt(cohortActivatingFrameIdStr, 10);
      if (!processedCohorts.has(cohortActivatingFrameId)) {
        await this.syncDbCohort(cohortActivatingFrameId, frameId, earningsFile.frameProgress);
        processedCohorts.add(cohortActivatingFrameId);
      }

      totalBlocksMined += cohortData.blocksMined;
      await this.syncDbCohortFrame(cohortActivatingFrameId, frameId, cohortData);
    }

    const isProcessed = earningsFile.frameProgress === 100.0;
    await this.db.framesTable.update(
      frameId,
      earningsFile.firstTick,
      earningsFile.lastTick,
      earningsFile.firstBlockNumber,
      earningsFile.lastBlockNumber,
      earningsFile.microgonToUsd,
      earningsFile.microgonToBtc,
      earningsFile.microgonToArgonot,
      earningsFile.frameProgress,
      isProcessed,
    );
  }

  private async syncDbCohortFrame(
    cohortActivatingFrameId: number,
    frameId: number,
    cohortData: IEarningsFileCohort,
  ): Promise<void> {
    await this.db.cohortFramesTable.insertOrUpdate(
      frameId,
      cohortActivatingFrameId,
      cohortData.blocksMined,
      cohortData.micronotsMined,
      cohortData.microgonsMined,
      cohortData.microgonsMinted,
    );
  }

  private async syncDbCohort(
    cohortActivatingFrameId: number,
    currentFrameId: number,
    currentFrameProgress: number,
  ): Promise<void> {
    const data = await StatsFetcher.fetchBidsFile(cohortActivatingFrameId);
    if (data.frameBiddingProgress < 100.0) return;

    try {
      const mainchainClient = await this.mainchain.client;
      const [cohortStartingTick] = await this.miningFrames.getTickRangeForFrame(
        mainchainClient,
        cohortActivatingFrameId,
      );
      const cohortEndingTick = cohortStartingTick + TICKS_PER_COHORT;
      const framesCompleted = currentFrameId - cohortActivatingFrameId;
      const miningSeatCount = BigInt(await this.mainchain.getMiningSeatCount());
      const progress = (framesCompleted * 100.0 + currentFrameProgress) / 10.0;
      const micronotsStaked = data.micronotsStakedPerSeat * BigInt(data.seatsWon);

      const microgonsToBeMinedDuringCohort = data.microgonsToBeMinedPerBlock * BigInt(TICKS_PER_COHORT);
      const micronotsToBeMinedDuringCohort = await this.mainchain.getMinimumBlockRewardsDuringTickRange(
        BigInt(cohortStartingTick),
        BigInt(cohortEndingTick),
      );
      const microgonsToBeMinedPerSeat = microgonsToBeMinedDuringCohort / miningSeatCount;
      const micronotsToBeMinedPerSeat = micronotsToBeMinedDuringCohort / miningSeatCount;

      await this.db.cohortsTable.insertOrUpdate(
        cohortActivatingFrameId,
        progress,
        data.transactionFees,
        micronotsStaked,
        data.microgonsBidTotal,
        data.seatsWon,
        microgonsToBeMinedPerSeat,
        micronotsToBeMinedPerSeat,
      );

      await this.db.cohortAccountsTable.deleteForCohort(cohortActivatingFrameId);

      for (const subaccount of data.winningBids) {
        if (subaccount.subAccountIndex === undefined) return;
        await this.db.cohortAccountsTable.insert(
          subaccount.subAccountIndex,
          cohortActivatingFrameId,
          subaccount.address,
          subaccount.microgonsBid ?? 0n,
          subaccount.bidPosition ?? 0,
        );
      }
    } catch (e) {
      console.error('Error syncing cohort:', e);
      throw e;
    }
  }

  private async updateArgonActivity(): Promise<void> {
    const latestBlockNumbers = this.syncState.argonBlockNumbers;
    const lastArgonActivity = await this.db.argonActivitiesTable.latest();

    const localhostMatches = lastArgonActivity?.localNodeBlockNumber === latestBlockNumbers.localNode;
    const mainchainMatches = lastArgonActivity?.mainNodeBlockNumber === latestBlockNumbers.mainNode;

    if (!localhostMatches || !mainchainMatches) {
      await this.db.argonActivitiesTable.insert(latestBlockNumbers.localNode, latestBlockNumbers.mainNode);
    }
    this.fnByKey.updateArgonActivity?.();
  }

  private async updateBitcoinActivity(): Promise<void> {
    const latestBlockNumbers = this.syncState.bitcoinBlockNumbers;
    const savedActivity = await this.db.bitcoinActivitiesTable.latest();

    const localhostMatches = savedActivity?.localNodeBlockNumber === latestBlockNumbers.localNode;
    const mainchainMatches = savedActivity?.mainNodeBlockNumber === latestBlockNumbers.mainNode;

    if (!localhostMatches || !mainchainMatches) {
      await this.db.bitcoinActivitiesTable.insert(latestBlockNumbers.localNode, latestBlockNumbers.mainNode);
    }
    this.fnByKey.updateBitcoinActivity?.();
  }

  private async updateBotActivity(): Promise<void> {
    const botHistory = await StatsFetcher.fetchBotHistory();
    // TODO: Implement bot activity update logic
    this.fnByKey.updateBotActivity?.();
  }

  private async calculateSyncProgress(syncState: ISyncState | ISyncStateStarting): Promise<number> {
    const botSyncProgress = syncState.syncProgress * 0.9;

    if (botSyncProgress < 90.0) {
      return botSyncProgress;
    }

    const dbSyncProgress = (await this.calculateDbSyncProgress(syncState)) * 0.1;

    return botSyncProgress + dbSyncProgress;
  }

  private async calculateDbSyncProgress(syncState: ISyncState | ISyncStateStarting): Promise<number> {
    const { oldestFrameIdToSync, currentFrameId } = syncState as ISyncState;
    if (!oldestFrameIdToSync || !currentFrameId) {
      return 0.0;
    }

    const dbFramesExpected = currentFrameId - oldestFrameIdToSync; // do not include the current frame since it is not processed yet
    const dbFramesProcessed = await this.db.framesTable.fetchProcessedCount();

    if (dbFramesProcessed === dbFramesExpected) {
      return 100.0;
    }

    return (dbFramesProcessed / dbFramesExpected) * 100.0;
  }
}
