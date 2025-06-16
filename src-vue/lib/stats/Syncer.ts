import { Config } from '../Config';
import { Db } from '../Db';
import { StatsFetcher } from './Fetcher';
import { IEarningsFileCohort, ISyncState } from '@argonprotocol/commander-bot/src/storage';

export class StatsSyncer {
  public isMissingCurrentFrame: boolean = false;

  private isSynced: boolean = false;
  private db: Db;
  private config: Config;

  private oldestFrameIdToSync!: number;
  private currentFrameId!: number;

  constructor(config: Config, db: Db) {
    this.config = config;
    this.db = db;
  }

  public async sync(syncState: ISyncState): Promise<void> {
    if (this.isSynced) return;
    console.log('== SYNC STARTED ==========================================');

    this.oldestFrameIdToSync = syncState.oldestFrameIdToSync;
    this.currentFrameId = syncState.currentFrameId;

    const rawProgress = await this.calculateSyncProgress(syncState);

    if (rawProgress >= 100.0) {
      if (this.config.syncDetails.startDate) {
        this.config.resetField('syncDetails');
        this.config.save();
      }
      this.isSynced = true;
      console.log('SYNC NOT NEEDED');
      return undefined;
    }

    if (!this.config.syncDetails.startDate) {
      this.config.syncDetails = {
        progress: 0,
        startDate: new Date().toISOString(),
        startPosition: rawProgress,
        errorType: null,
        errorMessage: null,
      };
      await this.config.save();
    }

    while (syncState.loadProgress < 100.0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      syncState = await StatsFetcher.fetchSyncState(this.localPort);
      this.updateSyncDetailsProgress(syncState);
    }

    for (let frameId = this.oldestFrameIdToSync; frameId <= this.currentFrameId; frameId++) {
      console.log('Syncing frame:', frameId);
      await this.syncDbFrame(frameId);
      this.updateSyncDetailsProgress(syncState);
    }

    this.isMissingCurrentFrame = false;

    console.log('== SYNC COMPLETED ==========================================');
    this.isSynced = true;
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
      earningsFile.frameProgress,
      false,
    );

    const processedCohorts: Set<number> = new Set();
    let totalBlocksMined = 0;

    const cohortsById = Object.entries(earningsFile.byCohortActivatingFrameId) as [
      string,
      IEarningsFileCohort,
    ][];

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
      Number(cohortData.argonotsMined),
      Number(cohortData.argonsMined),
      Number(cohortData.argonsMinted),
    );
  }

  private async syncDbCohort(
    cohortActivatingFrameId: number,
    currentFrameId: number,
    currentFrameProgress: number,
  ): Promise<void> {
    const data = await StatsFetcher.fetchBidsFile(cohortActivatingFrameId);

    if (data.frameBiddingProgress < 100.0) {
      return;
    }

    const framesCompleted = currentFrameId - cohortActivatingFrameId;
    const progress = (framesCompleted * 100.0 + currentFrameProgress) / 10.0;
    const argonotsStaked = Number(data.argonotsStakedPerSeat) * data.seatsWon;

    await this.db.cohortsTable.insertOrUpdate(
      cohortActivatingFrameId,
      progress,
      Number(data.transactionFees),
      argonotsStaked,
      Number(data.argonsBidTotal),
      data.seatsWon,
    );

    await this.db.cohortAccountsTable.deleteForCohort(cohortActivatingFrameId);

    for (const subaccount of data.winningBids) {
      if (subaccount.subAccountIndex === undefined) return;
      await this.db.cohortAccountsTable.insert(
        subaccount.subAccountIndex,
        cohortActivatingFrameId,
        subaccount.address,
        Number(subaccount.argonsBid ?? 0n),
        Number(subaccount.bidPosition ?? 0n),
      );
    }
  }

  private async updateSyncDetailsProgress(syncState: ISyncState): Promise<void> {
    const rawProgress = await this.calculateSyncProgress(syncState);
    const startPosition = this.config.syncDetails.startPosition ?? 0;
    const adjustedProgress = ((rawProgress - startPosition) / (100 - startPosition)) * 100;
    this.config.syncDetails.progress = adjustedProgress;
    this.config.syncDetails = this.config.syncDetails;
    await this.config.save();
  }

  private async calculateSyncProgress(syncState: ISyncState): Promise<number> {
    const botLoadProgress = syncState.loadProgress * 0.9;

    if (botLoadProgress < 90.0) {
      return botLoadProgress;
    }

    const dbSyncProgress = (await this.calculateDbSyncProgress()) * 0.1;

    return botLoadProgress + dbSyncProgress;
  }

  private async calculateDbSyncProgress(): Promise<number> {
    const dbFramesExpected = this.currentFrameId - this.oldestFrameIdToSync + 1; // +1 because we want to include the current frame
    const dbFramesProcessed = await this.db.framesTable.fetchProcessedCount();

    if (dbFramesProcessed === dbFramesExpected) {
      this.isMissingCurrentFrame = false;
      return 100.0;
    }

    if (dbFramesProcessed === dbFramesExpected - 1) {
      try {
        const currentFrame = await this.db.framesTable.fetchById(this.currentFrameId);
        if (!currentFrame.isProcessed) {
          return 100.0;
        }
      } catch {
        this.isMissingCurrentFrame = true;
        return 100.0;
      }
    }

    return (dbFramesProcessed / dbFramesExpected) * 100.0;
  }
}
