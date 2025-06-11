import { Db } from '../Db';
import { StatsFetcher } from './Fetcher';
import { IEarningsFileCohort } from '@argonprotocol/commander-bot/src/storage';

export class StatsSyncer {
  private localPort: number;
  private isRunning: boolean = false;
  private db: Db;

  constructor(localPort: number, db: Db) {
    this.localPort = localPort;
    this.db = db;
  }

  public async run(
    oldestFrameIdToSync: number,
    currentFrameId: number
  ): Promise<void> {
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

    const earningsFile = await StatsFetcher.fetchEarningsFile(this.localPort, frameId);

    await this.db.framesTable.insertOrUpdate(
      frameId,
      earningsFile.frameTickStart,
      earningsFile.frameTickEnd,
      earningsFile.frameProgress,
      false
    );

    const processedCohorts: Set<number> = new Set();
    let totalBlocksMined = 0;

    const cohortsById = Object.entries(earningsFile.byCohortFrameId) as [string, IEarningsFileCohort][];
    for (const [cohortFrameIdStr, cohortData] of cohortsById) {
      const cohortFrameId = parseInt(cohortFrameIdStr, 10);
      if (!processedCohorts.has(cohortFrameId)) {
        await this.syncDbCohort(cohortFrameId, frameId, earningsFile.frameProgress);
        processedCohorts.add(cohortFrameId);
      }

      totalBlocksMined += cohortData.blocksMined;
      await this.syncDbCohortFrame(cohortFrameId, frameId, cohortData);
    }

    console.info(`TOTAL BLOCKS MINED: ${totalBlocksMined}`);

    const isProcessed = earningsFile.frameProgress === 100.0;
    await this.db.framesTable.update(
      frameId,
      earningsFile.frameTickStart,
      earningsFile.frameTickEnd,
      earningsFile.frameProgress,
      isProcessed
    );
  }

  async syncDbCohortFrame(cohortFrameId: number, frameId: number, cohortData: IEarningsFileCohort): Promise<void> {
    await this.db.cohortFramesTable.insertOrUpdate(
      frameId,
      cohortFrameId,
      cohortData.blocksMined,
      Number(cohortData.argonotsMined),
      Number(cohortData.argonsMined),
      Number(cohortData.argonsMinted)
    );
  }

  async syncDbCohort(cohortStartingFrameId: number, currentFrameId: number, currentFrameProgress: number): Promise<void> {
    const data = await StatsFetcher.fetchBidsFile(this.localPort, cohortStartingFrameId);

    if (data.frameBiddingProgress < 100.0) {
      return;
    }

    const framesCompleted = currentFrameId - cohortStartingFrameId;
    const progress = ((framesCompleted * 100.0) + currentFrameProgress) / 10.0;
    const argonotsStaked = Number(data.argonotsStakedPerSeat) * data.seatsWon;

    await this.db.cohortsTable.insertOrUpdate(
      cohortStartingFrameId,
      progress,
      Number(data.transactionFees),
      argonotsStaked,
      Number(data.argonsBidTotal),
      data.seatsWon
    );

    await this.db.cohortAccountsTable.deleteForCohort(cohortStartingFrameId);

    for (const subaccount of data.subaccounts) {
      await this.db.cohortAccountsTable.insert(
        subaccount.index,
        cohortStartingFrameId,
        subaccount.address,
        Number(subaccount.argonsBid ?? 0n),
        Number(subaccount.bidPosition ?? 0n)
      );
    }
  }
} 