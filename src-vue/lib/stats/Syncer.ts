import { Db } from '../Db';
import { StatsFetcher } from './Fetcher';
import { IEarningsFileCohort } from '@argonprotocol/commander-bot/src/storage';

export class StatsSyncer {
  private isRunning: boolean = false;
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  public async run(oldestFrameIdToSync: number, currentFrameId: number): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.syncDb(oldestFrameIdToSync, currentFrameId);

    // TODO: Implement actual sync thread launching logic
    throw new Error('Not implemented');
  }

  async syncDb(oldestFrameIdToSync: number, currentFrameId: number): Promise<void> {
    for (let frameId = oldestFrameIdToSync; frameId <= currentFrameId; frameId++) {
      console.info(`Syncing frame: ${frameId}`);
      await this.syncDbFrame(frameId);
    }
  }

  async syncDbFrame(frameId: number): Promise<void> {
    const frame = await this.db.framesTable.fetchById(frameId);
    if (frame?.isProcessed) {
      return;
    }

    const earningsFile = await StatsFetcher.fetchEarningsFile(frameId);

    await this.db.framesTable.insertOrUpdate(
      frameId,
      earningsFile.frameTickStart,
      earningsFile.frameTickEnd,
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
      earningsFile.frameTickStart,
      earningsFile.frameTickEnd,
      earningsFile.frameProgress,
      isProcessed,
    );
  }

  async syncDbCohortFrame(
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

  async syncDbCohort(
    cohortActivatingFrameId: number,
    currentFrameId: number,
    currentFrameProgress: number,
  ): Promise<void> {
    const data = await StatsFetcher.fetchBidsFile(this.localPort, cohortActivatingFrameId);

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
      await this.db.cohortAccountsTable.insert(
        subaccount.subAccountIndex,
        cohortActivatingFrameId,
        subaccount.address,
        Number(subaccount.argonsBid ?? 0n),
        Number(subaccount.bidPosition ?? 0n),
      );
    }
  }
}
