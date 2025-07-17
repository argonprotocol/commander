import { Config } from './Config';
import { Db } from './Db';
import { BotFetch } from './BotFetch';
import { IEarningsFileCohort, IBotState, IBotStateStarting, IBidsFile } from '@argonprotocol/commander-bot/src/storage';
import { MiningFrames, TICKS_PER_COHORT } from '@argonprotocol/commander-calculator';
import { getMainchain } from '../stores/mainchain';
import { BotServerIsLoading, BotServerIsSyncing } from '../interfaces/BotErrors';
import { IBotEmitter } from './Bot';

export enum BotStatus {
  Starting = 'Starting',
  ServerSyncing = 'ServerSyncing',
  DbSyncing = 'DbSyncing',
  Ready = 'Ready',
  Broken = 'Broken',
}

export type IBotFns = {
  onEvent: (type: keyof IBotEmitter, payload?: any) => void;
  setStatus: (x: BotStatus) => void;
  setServerSyncProgress: (x: number) => void;
  setDbSyncProgress: (x: number) => void;
  setMaxSeatsPossible: (x: number) => void;
  setMaxSeatsReductionReason: (x: string) => void;
};

export class BotSyncer {
  public isMissingCurrentFrame: boolean = false;

  private db: Db;
  private config: Config;
  private botState!: IBotState;
  private botFns: IBotFns;

  private isSyncingThePast: boolean = false;

  private mainchain = getMainchain();

  private bidsFileByActivatingFrameId: Record<number, IBidsFile> = {};

  constructor(config: Config, db: Db, botFn: IBotFns) {
    this.config = config;
    this.db = db;
    this.botFns = botFn;
  }

  public async load(): Promise<void> {
    await this.config.isLoadedPromise;

    this.runContinuously();
  }

  private async runContinuously(): Promise<void> {
    if (this.isRunnable) {
      try {
        await this.updateBotState();
        await this.updateArgonActivity();
        await this.updateBitcoinActivity();
        await this.updateWinningBids();
      } catch (e) {
        if (e instanceof BotServerIsLoading) {
          this.botFns.setStatus(BotStatus.Starting);
        } else if (e instanceof BotServerIsSyncing) {
          this.botFns.setStatus(BotStatus.ServerSyncing);
          this.botFns.setServerSyncProgress(e.progress);
        } else {
          this.botFns.setStatus(BotStatus.Broken);
        }
      }
    }

    setTimeout(this.runContinuously.bind(this), 5000);
  }

  private get isRunnable(): boolean {
    return (
      this.config.isServerReadyToInstall &&
      this.config.isServerUpToDate &&
      this.config.isServerInstalled &&
      this.config.hasSavedBiddingRules &&
      !this.config.isWaitingForUpgradeApproval
    );
  }

  private async updateWinningBids() {
    const activeBidsFile = await BotFetch.fetchBidsFile();

    for (const [bidPosition, bid] of activeBidsFile.winningBids.entries()) {
      await this.db.frameBidsTable.insertOrUpdate(
        this.botState.currentFrameId,
        bid.address,
        bid.subAccountIndex,
        bid.microgonsBid ?? 0n,
        bidPosition,
        bid.lastBidAtTick,
      );
    }

    this.botFns.onEvent('updated-bids-data', activeBidsFile.winningBids);
  }

  private async updateBotState(retries: number = 0): Promise<void> {
    this.botState = await BotFetch.fetchBotState();

    this.botFns.setMaxSeatsReductionReason(this.botState.maxSeatsReductionReason);
    this.botFns.setMaxSeatsPossible(this.botState.maxSeatsPossible);

    if (this.botState.oldestFrameIdToSync > 0) {
      this.config.oldestFrameIdToSync = this.botState.oldestFrameIdToSync;
    }

    this.config.hasMiningSeats = this.botState.hasMiningSeats;
    this.config.hasMiningBids = this.botState.hasMiningBids;

    await this.config.save();

    let dbSyncProgress = await this.calculateDbSyncProgress(this.botState);

    if (dbSyncProgress < 100.0) {
      this.botFns.setStatus(BotStatus.DbSyncing);
      this.botFns.setDbSyncProgress(dbSyncProgress);
      dbSyncProgress = await this.syncThePast(dbSyncProgress);
    }
    if (dbSyncProgress < 100.0) return;

    this.botFns.setStatus(BotStatus.Ready);
    this.botFns.onEvent('updated-cohort-data', this.botState.currentFrameId);
  }

  private async syncThePast(progress: number): Promise<number> {
    if (this.isSyncingThePast) {
      return progress;
    }

    this.isSyncingThePast = true;

    const oldestFrameIdToSync = this.botState.oldestFrameIdToSync;
    const currentFrameId = this.botState.currentFrameId;
    const framesToSync = currentFrameId - oldestFrameIdToSync + 1;

    const promise = new Promise<number>(async resolve => {
      for (let frameId = oldestFrameIdToSync; frameId <= currentFrameId; frameId++) {
        await this.syncDbFrame(frameId);
        progress = await this.calculateDbSyncProgress(this.botState);
        this.botFns.setDbSyncProgress(progress);
      }

      this.bidsFileByActivatingFrameId = {};
      resolve(progress);
    });

    if (framesToSync < 2) {
      await promise;
    }

    return progress;
  }

  public async syncDbFrame(frameId: number): Promise<void> {
    const earningsFile = await BotFetch.fetchEarningsFile(frameId);

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

    // Every frame should have a coresponding cohort, even if it has no seats
    await this.syncDbCohort(frameId);
    const processedCohorts: Set<number> = new Set([frameId]);

    const cohortEarningsByFrameId = await this.injectMissingCohortEarnings(
      earningsFile.byCohortActivatingFrameId,
      frameId,
    );
    const cohortEarningsEntries = Object.entries(cohortEarningsByFrameId) as [string, IEarningsFileCohort][];

    for (const [cohortActivatingFrameIdStr, cohortEarningsDuringFrame] of cohortEarningsEntries) {
      const cohortActivatingFrameId = parseInt(cohortActivatingFrameIdStr, 10);
      if (!processedCohorts.has(cohortActivatingFrameId)) {
        await this.syncDbCohort(cohortActivatingFrameId);
        processedCohorts.add(cohortActivatingFrameId);
      }
      await this.syncDbCohortFrame(cohortActivatingFrameId, frameId, cohortEarningsDuringFrame);
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

  private async injectMissingCohortEarnings(
    cohortEarningsByFrameId: Record<string, IEarningsFileCohort>,
    currentFrameId: number,
  ): Promise<Record<string, IEarningsFileCohort>> {
    // Check previous 9 frames for to ensure we have all active cohorts in earnings object
    for (let i = 0; i < 10; i++) {
      const frameIdToCheck = currentFrameId - i;
      if (cohortEarningsByFrameId[frameIdToCheck]) continue;

      let didWinSeats = false;
      const cohort = await this.db.cohortsTable.fetchById(frameIdToCheck);

      if (cohort) {
        didWinSeats = !!cohort.seatsWon;
      } else {
        const bidsFile = await this.fetchBidsFileByActivatingFrameId(frameIdToCheck);
        didWinSeats = !!bidsFile.winningBids.filter(x => x.subAccountIndex !== undefined).length;
      }

      if (didWinSeats) {
        cohortEarningsByFrameId[frameIdToCheck] = {
          lastBlockMinedAt: '',
          blocksMined: 0,
          microgonsMined: 0n,
          microgonsMinted: 0n,
          micronotsMined: 0n,
        };
      }
    }

    return cohortEarningsByFrameId;
  }

  private async syncDbCohort(cohortActivatingFrameId: number): Promise<void> {
    const bidsFile = await this.fetchBidsFileByActivatingFrameId(cohortActivatingFrameId);
    if (bidsFile.frameBiddingProgress < 100.0) return;

    try {
      const mainchainClient = await this.mainchain.client;
      const [cohortStartingTick] = await MiningFrames.getTickRangeForFrame(mainchainClient, cohortActivatingFrameId);
      const cohortEndingTick = cohortStartingTick + TICKS_PER_COHORT;
      const framesCompleted = Math.min(this.botState.currentFrameId - cohortActivatingFrameId, 10);
      const miningSeatCount = BigInt(await this.mainchain.getMiningSeatCount());
      const progress = Math.min((framesCompleted * 100 + this.botState.currentFrameProgress) / 10, 100);
      const micronotsStaked = bidsFile.micronotsStakedPerSeat * BigInt(bidsFile.seatsWon);

      const microgonsToBeMinedDuringCohort = bidsFile.microgonsToBeMinedPerBlock * BigInt(TICKS_PER_COHORT);
      const micronotsToBeMinedDuringCohort = await this.mainchain.getMinimumBlockRewardsDuringTickRange(
        BigInt(cohortStartingTick),
        BigInt(cohortEndingTick),
      );
      const microgonsToBeMinedPerSeat = microgonsToBeMinedDuringCohort / miningSeatCount;
      const micronotsToBeMinedPerSeat = micronotsToBeMinedDuringCohort / miningSeatCount;

      await this.db.cohortsTable.insertOrUpdate(
        cohortActivatingFrameId,
        progress,
        bidsFile.transactionFees,
        micronotsStaked,
        bidsFile.microgonsBidTotal,
        bidsFile.seatsWon,
        microgonsToBeMinedPerSeat,
        micronotsToBeMinedPerSeat,
      );

      await this.updateDbCohortAccounts(cohortActivatingFrameId, bidsFile);
    } catch (e) {
      console.error('Error syncing cohort:', e);
      throw e;
    }
  }

  private async updateDbCohortAccounts(cohortActivatingFrameId: number, bidsFile: IBidsFile): Promise<void> {
    await this.db.cohortAccountsTable.deleteForCohort(cohortActivatingFrameId);

    for (const subaccount of bidsFile.winningBids) {
      if (subaccount.subAccountIndex === undefined) return;
      await this.db.cohortAccountsTable.insert(
        subaccount.subAccountIndex,
        cohortActivatingFrameId,
        subaccount.address,
        subaccount.microgonsBid ?? 0n,
        subaccount.bidPosition ?? 0,
      );
    }
  }

  private async syncDbCohortFrame(
    cohortActivatingFrameId: number,
    frameId: number,
    cohortEarningsDuringFrame: IEarningsFileCohort,
  ): Promise<void> {
    console.log('SYNCING COHORT FRAME', cohortActivatingFrameId, frameId);
    await this.db.cohortFramesTable.insertOrUpdate(
      frameId,
      cohortActivatingFrameId,
      cohortEarningsDuringFrame.blocksMined,
      cohortEarningsDuringFrame.micronotsMined,
      cohortEarningsDuringFrame.microgonsMined,
      cohortEarningsDuringFrame.microgonsMinted,
    );
  }

  private async fetchBidsFileByActivatingFrameId(cohortActivatingFrameId: number): Promise<IBidsFile> {
    if (this.isSyncingThePast && this.bidsFileByActivatingFrameId[cohortActivatingFrameId]) {
      return this.bidsFileByActivatingFrameId[cohortActivatingFrameId];
    }

    const bidsFile = await BotFetch.fetchBidsFile(cohortActivatingFrameId);

    if (this.isSyncingThePast) {
      this.bidsFileByActivatingFrameId[cohortActivatingFrameId] = bidsFile;
    }

    return bidsFile;
  }

  private async updateArgonActivity(): Promise<void> {
    const latestBlockNumbers = this.botState.argonBlockNumbers;
    const lastArgonActivity = await this.db.argonActivitiesTable.latest();

    const localhostMatches = lastArgonActivity?.localNodeBlockNumber === latestBlockNumbers.localNode;
    const mainchainMatches = lastArgonActivity?.mainNodeBlockNumber === latestBlockNumbers.mainNode;

    if (!localhostMatches || !mainchainMatches) {
      await this.db.argonActivitiesTable.insert(latestBlockNumbers.localNode, latestBlockNumbers.mainNode);
    }

    this.botFns.onEvent('updated-argon-activity');
  }

  private async updateBitcoinActivity(): Promise<void> {
    const latestBlockNumbers = this.botState.bitcoinBlockNumbers;
    const savedActivity = await this.db.bitcoinActivitiesTable.latest();

    const localhostMatches = savedActivity?.localNodeBlockNumber === latestBlockNumbers.localNode;
    const mainchainMatches = savedActivity?.mainNodeBlockNumber === latestBlockNumbers.mainNode;

    if (!localhostMatches || !mainchainMatches) {
      await this.db.bitcoinActivitiesTable.insert(latestBlockNumbers.localNode, latestBlockNumbers.mainNode);
    }

    this.botFns.onEvent('updated-bitcoin-activity');
  }

  private async updateBiddingActivity(): Promise<void> {
    const botHistory = await BotFetch.fetchBotHistory();
    // TODO: Implement bot activity update logic
    this.botFns.onEvent('updated-bidding-activity');
  }

  private async calculateDbSyncProgress(botState: IBotState | IBotStateStarting): Promise<number> {
    const { oldestFrameIdToSync, currentFrameId } = botState as IBotState;
    if (!oldestFrameIdToSync || !currentFrameId) {
      return 0.0;
    }

    const dbFramesExpected = currentFrameId - oldestFrameIdToSync; // do not include the current frame since it is not processed yet
    if (!dbFramesExpected) return 100.0;

    const dbFramesProcessed = await this.db.framesTable.fetchProcessedCount();
    const dbCohortsProcessed = await this.db.cohortsTable.fetchCount();

    return (Math.min(dbFramesProcessed, dbCohortsProcessed) / dbFramesExpected) * 100;
  }
}
