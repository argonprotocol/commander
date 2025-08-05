import { Config } from './Config';
import { Db } from './Db';
import { BotFetch } from './BotFetch';
import {
  type IEarningsFileCohort,
  type IBotState,
  type IBotStateStarting,
  type IBidsFile,
} from '@argonprotocol/commander-bot';
import { MiningFrames, TICKS_PER_COHORT } from '@argonprotocol/commander-calculator';
import { getMainchain } from '../stores/mainchain';
import { BotServerIsLoading, BotServerIsSyncing } from '../interfaces/BotErrors';
import { IBotEmitter } from './Bot';
import Installer from './Installer';
import { activeAnimations } from 'motion-v';

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
  public isPaused: boolean = false;

  private db: Db;
  private config: Config;
  private botState!: IBotState;
  private botFns: IBotFns;
  private installer: Installer;

  private isSyncingThePast: boolean = false;

  private mainchain = getMainchain();

  private bidsFileCacheByActivationFrameId: Record<number, [number, IBidsFile]> = {};

  constructor(config: Config, db: Db, installer: Installer, botFn: IBotFns) {
    this.config = config;
    this.db = db;
    this.installer = installer;
    this.botFns = botFn;
  }

  public async load(): Promise<void> {
    await this.config.isLoadedPromise;
    await this.installer.isLoadedPromise;

    this.runContinuously();
  }

  private async runContinuously(): Promise<void> {
    if (this.isRunnable) {
      try {
        await this.updateBotState();
        await this.syncArgonActivity();
        await this.syncBitcoinActivity();
        await this.syncBotActivity();
        await this.syncCurrentBids();

        if (!this.isSyncingThePast) {
          this.botFns.setStatus(BotStatus.Ready);
          this.botFns.onEvent('updated-cohort-data', this.botState.currentFrameId);
        }
      } catch (e) {
        if (e instanceof BotServerIsLoading) {
          this.botFns.setStatus(BotStatus.Starting);
        } else if (e instanceof BotServerIsSyncing) {
          this.botFns.setStatus(BotStatus.ServerSyncing);
          this.botFns.setServerSyncProgress(e.progress);
        } else {
          this.botFns.setStatus(BotStatus.Broken);
          console.error('BotSyncer error:', e);
        }
      }
    }

    setTimeout(this.runContinuously.bind(this), 5000);
  }

  private get isRunnable(): boolean {
    return (
      !this.isPaused &&
      this.config.isServerReadyToInstall &&
      this.config.isServerUpToDate &&
      this.config.isServerInstalled &&
      this.config.hasSavedBiddingRules &&
      !this.config.isWaitingForUpgradeApproval
    );
  }

  private async syncCurrentBids() {
    const activeBidsFile = await BotFetch.fetchBidsFile();

    for (const [bidPosition, bid] of activeBidsFile.winningBids.entries()) {
      await this.db.frameBidsTable.insertOrUpdate(
        activeBidsFile.cohortBiddingFrameId,
        activeBidsFile.lastBlockNumber,
        bid.address,
        bid.subAccountIndex,
        bid.microgonsBid ?? 0n,
        bidPosition,
        bid.lastBidAtTick,
      );
    }

    await this.db.execute('DELETE FROM FrameBids WHERE frameId = ? AND confirmedAtBlockNumber != ?', [
      activeBidsFile.cohortBiddingFrameId,
      activeBidsFile.lastBlockNumber,
    ]);

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
      await this.syncThePast(dbSyncProgress);
    } else {
      this.syncCurrentFrame();
    }
  }

  private async syncCurrentFrame(): Promise<void> {
    await this.syncDbFrame(this.botState.currentFrameId);
  }

  private async syncThePast(progress: number): Promise<void> {
    if (this.isSyncingThePast) return;
    this.isSyncingThePast = true;

    const oldestFrameIdToSync = this.botState.oldestFrameIdToSync;
    const currentFrameId = this.botState.currentFrameId;
    const framesToSync = currentFrameId - oldestFrameIdToSync + 1;

    const promise = new Promise<void>(async resolve => {
      for (let frameId = oldestFrameIdToSync; frameId <= currentFrameId; frameId++) {
        await this.syncDbFrame(frameId);
        progress = await this.calculateDbSyncProgress(this.botState);
        this.botFns.setDbSyncProgress(progress);
      }

      if (progress > -100) {
        this.isSyncingThePast = false;
      }
      resolve();
    });

    if (framesToSync < 2) {
      await promise;
    }
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
      earningsFile.byCohortActivationFrameId,
      frameId,
    );
    const cohortEarningsEntries = Object.entries(cohortEarningsByFrameId) as [string, IEarningsFileCohort][];

    let blocksMined = 0;
    let micronotsMined = 0n;
    let microgonsMined = 0n;
    let microgonsMinted = 0n;

    for (const [cohortActivationFrameIdStr, cohortEarningsDuringFrame] of cohortEarningsEntries) {
      const cohortActivationFrameId = parseInt(cohortActivationFrameIdStr, 10);
      if (!processedCohorts.has(cohortActivationFrameId)) {
        await this.syncDbCohort(cohortActivationFrameId);
        processedCohorts.add(cohortActivationFrameId);
      }
      await this.syncDbCohortFrame(cohortActivationFrameId, frameId, cohortEarningsDuringFrame);
      blocksMined += cohortEarningsDuringFrame.blocksMined;
      micronotsMined += cohortEarningsDuringFrame.micronotsMined;
      microgonsMined += cohortEarningsDuringFrame.microgonsMined;
      microgonsMinted += cohortEarningsDuringFrame.microgonsMinted;
    }

    const { activeSeatCount, totalSeatCost } = await this.db.cohortsTable.fetchActiveSeatData(
      frameId,
      earningsFile.frameProgress,
    );

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

      activeSeatCount,
      totalSeatCost,
      blocksMined,
      micronotsMined,
      microgonsMined,
      microgonsMinted,

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
        const bidsFile = await this.fetchBidsFileFromCache({ cohortActivationFrameId: frameIdToCheck });
        didWinSeats = !!bidsFile.winningBids.filter(x => typeof x.subAccountIndex === 'number').length;
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

  private async syncDbCohort(cohortActivationFrameId: number): Promise<void> {
    const bidsFile = await this.fetchBidsFileFromCache({ cohortActivationFrameId });
    if (bidsFile.frameBiddingProgress < 100.0) return;

    try {
      const mainchainClient = await this.mainchain.client;
      const [cohortStartingTick] = await MiningFrames.getTickRangeForFrame(mainchainClient, cohortActivationFrameId);
      const cohortEndingTick = cohortStartingTick + TICKS_PER_COHORT;
      const framesCompleted = Math.min(this.botState.currentFrameId - cohortActivationFrameId, 10);
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
        cohortActivationFrameId,
        progress,
        bidsFile.transactionFees,
        micronotsStaked,
        bidsFile.microgonsBidTotal,
        bidsFile.seatsWon,
        microgonsToBeMinedPerSeat,
        micronotsToBeMinedPerSeat,
      );

      await this.updateDbCohortAccounts(cohortActivationFrameId, bidsFile);
    } catch (e) {
      console.error('Error syncing cohort:', e);
      throw e;
    }
  }

  private async updateDbCohortAccounts(cohortActivationFrameId: number, bidsFile: IBidsFile): Promise<void> {
    await this.db.cohortAccountsTable.deleteForCohort(cohortActivationFrameId);

    for (const subaccount of bidsFile.winningBids) {
      if (typeof subaccount.subAccountIndex !== 'number') return;
      await this.db.cohortAccountsTable.insert(
        subaccount.subAccountIndex,
        cohortActivationFrameId,
        subaccount.address,
        subaccount.microgonsBid ?? 0n,
        subaccount.bidPosition ?? 0,
      );
    }
  }

  private async syncDbCohortFrame(
    cohortActivationFrameId: number,
    frameId: number,
    cohortEarningsDuringFrame: IEarningsFileCohort,
  ): Promise<void> {
    await this.db.cohortFramesTable.insertOrUpdate(
      frameId,
      cohortActivationFrameId,
      cohortEarningsDuringFrame.blocksMined,
      cohortEarningsDuringFrame.micronotsMined,
      cohortEarningsDuringFrame.microgonsMined,
      cohortEarningsDuringFrame.microgonsMinted,
    );
  }

  // I'm using a hash to call out which frame ID is being used to fetch the bids file
  private async fetchBidsFileFromCache(id: { cohortActivationFrameId: number }): Promise<IBidsFile> {
    const { cohortActivationFrameId } = id;
    let [timeoutId, bidsFile] = this.bidsFileCacheByActivationFrameId[cohortActivationFrameId] || [];

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!bidsFile) {
      bidsFile = await BotFetch.fetchBidsFile(cohortActivationFrameId);
    }

    const isCurrentFrame = cohortActivationFrameId === this.botState.currentFrameId;
    const millisecondsToCache = isCurrentFrame ? 1_000 : 600_000;

    timeoutId = setTimeout(() => {
      delete this.bidsFileCacheByActivationFrameId[cohortActivationFrameId];
    }, millisecondsToCache) as unknown as number;

    this.bidsFileCacheByActivationFrameId[cohortActivationFrameId] = [timeoutId, bidsFile];

    return bidsFile;
  }

  private async syncArgonActivity(): Promise<void> {
    const latestBlockNumbers = this.botState.argonBlockNumbers;
    const lastArgonActivity = await this.db.argonActivitiesTable.latest();

    const localhostMatches = lastArgonActivity?.localNodeBlockNumber === latestBlockNumbers.localNode;
    const mainchainMatches = lastArgonActivity?.mainNodeBlockNumber === latestBlockNumbers.mainNode;

    if (!localhostMatches || !mainchainMatches) {
      await this.db.argonActivitiesTable.insert(
        this.botState.currentFrameId,
        latestBlockNumbers.localNode,
        latestBlockNumbers.mainNode,
      );
    }

    this.botFns.onEvent('updated-argon-activity');
  }

  private async syncBitcoinActivity(): Promise<void> {
    const latestBlockNumbers = this.botState.bitcoinBlockNumbers;
    const savedActivity = await this.db.bitcoinActivitiesTable.latest();

    const localhostMatches = savedActivity?.localNodeBlockNumber === latestBlockNumbers.localNode;
    const mainchainMatches = savedActivity?.mainNodeBlockNumber === latestBlockNumbers.mainNode;

    if (!localhostMatches || !mainchainMatches) {
      await this.db.bitcoinActivitiesTable.insert(
        this.botState.currentFrameId,
        latestBlockNumbers.localNode,
        latestBlockNumbers.mainNode,
      );
    }

    this.botFns.onEvent('updated-bitcoin-activity');
  }

  private async syncBotActivity(): Promise<void> {
    const history = await BotFetch.fetchHistory();

    for (const [index, activity] of history.activities.entries()) {
      await this.db.botActivitiesTable.insertOrUpdate(
        activity.id,
        activity.tick,
        activity.blockNumber,
        activity.frameId,
        activity.type,
        activity.data,
      );
    }

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
