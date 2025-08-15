import { Config } from './Config';
import { Db } from './Db';
import { BotFetch } from './BotFetch';
import { type IBidsFile, type IBotState, type IBotStateStarting } from '@argonprotocol/commander-bot';
import { MiningFrames, TICKS_PER_COHORT } from '@argonprotocol/commander-calculator';
import { getMainchain } from '../stores/mainchain';
import { BotServerIsLoading, BotServerIsSyncing } from '../interfaces/BotErrors';
import { IBotEmitter } from './Bot';
import Installer from './Installer';
import type { IFrameEarningsRollup } from '@argonprotocol/commander-bot/src/interfaces/IEarningsFile.ts';

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
  private lastModifiedDate: Date | null = null;

  constructor(config: Config, db: Db, installer: Installer, botFn: IBotFns) {
    this.config = config;
    this.db = db;
    this.installer = installer;
    this.botFns = botFn;
  }

  public async load(): Promise<void> {
    await this.config.isLoadedPromise;
    await this.installer.isLoadedPromise;

    void this.runContinuously();
  }

  private async runContinuously(): Promise<void> {
    if (this.isRunnable) {
      try {
        const lastModifiedDate = await BotFetch.lastModifiedDate();
        if ((lastModifiedDate?.getTime() ?? 0) > (this.lastModifiedDate?.getTime() ?? 0)) {
          this.lastModifiedDate = lastModifiedDate;
          await this.runSync();
        }
      } catch (error) {
        await this.installer.ensureIpAddressIsWhitelisted();
      }
    }

    setTimeout(this.runContinuously.bind(this), 1000);
  }

  private async runSync(): Promise<void> {
    try {
      console.log('BotSyncer: Running sync...');
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
      this.lastModifiedDate = null; // Reset last modified date to ensure we re-fetch on next run
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
        bid.microgonsPerSeat ?? 0n,
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
      await this.syncCurrentFrame();
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

    const earningsByCohortActivationFrameId: { [frameId: number]: IFrameEarningsRollup } = {};
    let maxBlockNumber = 0;
    for (const [blockNumberStr, earningsOfBlock] of Object.entries(earningsFile.earningsByBlock)) {
      const blockNumber = parseInt(blockNumberStr, 10);
      const cohortActivationFrameId = earningsOfBlock.authorCohortActivationFrameId;
      earningsByCohortActivationFrameId[cohortActivationFrameId] ??= {
        lastBlockMinedAt: '',
        blocksMinedTotal: 0,
        microgonFeesCollectedTotal: 0n,
        microgonsMinedTotal: 0n,
        microgonsMintedTotal: 0n,
        micronotsMinedTotal: 0n,
      };

      const earningsDuringFrame = earningsByCohortActivationFrameId[cohortActivationFrameId];
      earningsDuringFrame.blocksMinedTotal += 1;
      if (blockNumber > maxBlockNumber) {
        earningsDuringFrame.lastBlockMinedAt = earningsOfBlock.blockMinedAt;
        maxBlockNumber = blockNumber;
      }
      earningsDuringFrame.lastBlockMinedAt = earningsOfBlock.blockMinedAt;
      earningsDuringFrame.microgonFeesCollectedTotal += earningsOfBlock.microgonFeesCollected;
      earningsDuringFrame.microgonsMinedTotal += earningsOfBlock.microgonsMined;
      earningsDuringFrame.microgonsMintedTotal += earningsOfBlock.microgonsMinted;
      earningsDuringFrame.micronotsMinedTotal += earningsOfBlock.micronotsMined;
    }
    const cohortEarningsByFrameId = await this.injectMissingCohortEarnings(earningsByCohortActivationFrameId, frameId);
    const cohortEarningsEntries = Object.entries(cohortEarningsByFrameId);

    let blocksMinedTotal = 0;
    let micronotsMinedTotal = 0n;
    let microgonsMinedTotal = 0n;
    let microgonsMintedTotal = 0n;
    let microgonFeesCollectedTotal = 0n;

    for (const [cohortActivationFrameIdStr, cohortEarningsDuringFrame] of cohortEarningsEntries) {
      const cohortActivationFrameId = parseInt(cohortActivationFrameIdStr, 10);
      if (!processedCohorts.has(cohortActivationFrameId)) {
        await this.syncDbCohort(cohortActivationFrameId);
        processedCohorts.add(cohortActivationFrameId);
      }
      await this.syncDbCohortFrame(cohortActivationFrameId, frameId, cohortEarningsDuringFrame);
      blocksMinedTotal += cohortEarningsDuringFrame.blocksMinedTotal;
      micronotsMinedTotal += cohortEarningsDuringFrame.micronotsMinedTotal;
      microgonsMinedTotal += cohortEarningsDuringFrame.microgonsMinedTotal;
      microgonsMintedTotal += cohortEarningsDuringFrame.microgonsMintedTotal;
      microgonFeesCollectedTotal += cohortEarningsDuringFrame.microgonFeesCollectedTotal;
    }

    const { seatCountActive, seatCostTotalFramed } = await this.db.cohortsTable.fetchActiveSeatData(
      frameId,
      earningsFile.frameProgress,
    );

    const isProcessed = earningsFile.frameProgress === 100.0;
    await this.db.framesTable.update({
      id: frameId,
      firstTick: earningsFile.firstTick,
      lastTick: earningsFile.lastTick,
      firstBlockNumber: earningsFile.firstBlockNumber,
      lastBlockNumber: earningsFile.lastBlockNumber,
      microgonToUsd: earningsFile.microgonToUsd,
      microgonToBtc: earningsFile.microgonToBtc,
      microgonToArgonot: earningsFile.microgonToArgonot,

      seatCountActive,
      seatCostTotalFramed,
      blocksMinedTotal,
      micronotsMinedTotal,
      microgonsMinedTotal,
      microgonsMintedTotal,
      microgonFeesCollectedTotal,
      accruedMicrogonProfits: earningsFile.accruedMicrogonProfits,

      progress: earningsFile.frameProgress,
      isProcessed,
    });
  }

  private async injectMissingCohortEarnings(
    cohortEarningsByFrameId: Record<string, IFrameEarningsRollup>,
    currentFrameId: number,
  ): Promise<Record<string, IFrameEarningsRollup>> {
    // Check previous 9 frames for to ensure we have all active cohorts in earnings object
    for (let i = 0; i < 10; i++) {
      const frameIdToCheck = currentFrameId - i;
      if (cohortEarningsByFrameId[frameIdToCheck]) continue;

      let didWinSeats = false;
      const cohort = await this.db.cohortsTable.fetchById(frameIdToCheck);

      if (cohort) {
        didWinSeats = !!cohort.seatCountWon;
      } else {
        const bidsFile = await this.fetchBidsFileFromCache({ cohortActivationFrameId: frameIdToCheck });
        didWinSeats = !!bidsFile.winningBids.filter(x => typeof x.subAccountIndex === 'number').length;
      }

      if (didWinSeats) {
        cohortEarningsByFrameId[frameIdToCheck] = {
          lastBlockMinedAt: '',
          blocksMinedTotal: 0,
          microgonsMinedTotal: 0n,
          microgonsMintedTotal: 0n,
          micronotsMinedTotal: 0n,
          microgonFeesCollectedTotal: 0n,
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
      const micronotsStaked = bidsFile.micronotsStakedPerSeat * BigInt(bidsFile.seatCountWon);

      const microgonsToBeMinedDuringCohort = bidsFile.microgonsToBeMinedPerBlock * BigInt(TICKS_PER_COHORT);
      const micronotsToBeMinedDuringCohort = await this.mainchain.getMinimumBlockRewardsDuringTickRange(
        cohortStartingTick,
        cohortEndingTick,
      );
      const microgonsToBeMinedPerSeat = microgonsToBeMinedDuringCohort / miningSeatCount;
      const micronotsToBeMinedPerSeat = micronotsToBeMinedDuringCohort / miningSeatCount;
      const transactionFeesTotal = Object.values(bidsFile.transactionFeesByBlock).reduce((acc, fee) => acc + fee, 0n);
      const microgonsBidPerSeat =
        bidsFile.seatCountWon > 0 ? bidsFile.microgonsBidTotal / BigInt(bidsFile.seatCountWon) : 0n;

      await this.db.cohortsTable.insertOrUpdate(
        cohortActivationFrameId,
        progress,
        transactionFeesTotal,
        micronotsStaked,
        microgonsBidPerSeat,
        bidsFile.seatCountWon,
        microgonsToBeMinedPerSeat,
        micronotsToBeMinedPerSeat,
      );
    } catch (e) {
      console.error('Error syncing cohort:', e);
      throw e;
    }
  }

  private async syncDbCohortFrame(
    cohortActivationFrameId: number,
    frameId: number,
    cohortEarningsDuringFrame: IFrameEarningsRollup,
  ): Promise<void> {
    await this.db.cohortFramesTable.insertOrUpdate({
      frameId,
      cohortActivationFrameId,
      ...cohortEarningsDuringFrame,
    });
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
