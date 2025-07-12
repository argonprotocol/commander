import { Accountset, getClient, type KeyringPair } from '@argonprotocol/mainchain';
import { CohortStorage } from './storage.ts';
import { AutoBidder } from './AutoBidder.ts';
import { BlockSync } from './BlockSync.ts';
import { Dockers } from './Dockers.ts';
import { type IBidHistoryItem } from './interfaces/IBidHistoryItem.ts';
import { readJsonFileOrNull } from './utils.ts';
import type { IBiddingRules } from '@argonprotocol/commander-calculator';

interface IBotOptions {
  datadir: string;
  pair: KeyringPair;
  localRpcUrl: string;
  archiveRpcUrl: string;
  biddingRulesPath: string;
  keysMnemonic: string;
  oldestFrameIdToSync?: number;
  shouldSkipDockerSync?: boolean;
}

export default class Bot {
  public autobidder!: AutoBidder;
  public accountset!: Accountset;
  public blockSync!: BlockSync;
  public storage!: CohortStorage;

  public isReady: boolean = false;
  public isStarting: boolean = false;
  public isSyncing: boolean = false;
  public isWaitingForBiddingRules: boolean = false;

  public history: IBidHistoryItem[] = [];

  private options: IBotOptions;
  private biddingRules: IBiddingRules | null = null;

  constructor(options: IBotOptions) {
    this.options = options;
  }

  public async currentFrameId() {
    const state = await this.storage.syncStateFile().get();
    return state?.currentFrameId ?? 0;
  }

  public async start(): Promise<void> {
    if (this.isStarting || this.isReady) return;
    this.isStarting = true;

    this.options.shouldSkipDockerSync || (await this.waitForDockersToSync());

    const clientPromise = getClient(this.options.localRpcUrl);
    try {
      await clientPromise;
    } catch (error) {
      console.error('Error initializing local client', error);
      throw error;
    }

    this.biddingRules = readJsonFileOrNull(this.options.biddingRulesPath);
    this.storage = new CohortStorage(this.options.datadir, clientPromise);
    this.accountset = new Accountset({
      client: clientPromise,
      seedAccount: this.options.pair,
      sessionKeyMnemonic: this.options.keysMnemonic,
      subaccountRange: new Array(99).fill(0).map((_, i) => i),
    });
    this.autobidder = new AutoBidder(this.accountset, this.storage, this.biddingRules || ({} as IBiddingRules));
    this.blockSync = new BlockSync(
      this,
      this.autobidder,
      this.accountset,
      this.storage,
      this.options.archiveRpcUrl,
      this.options.oldestFrameIdToSync,
    );

    console.log('Initializing block sync');

    try {
      this.isSyncing = true;
      await this.blockSync.load();
      this.isSyncing = false;
    } catch (error) {
      console.error('Error loading block sync', error);
      throw error;
    }

    if (!this.biddingRules) {
      this.isWaitingForBiddingRules = true;
      return;
    }

    try {
      await this.blockSync.start();
    } catch (error) {
      console.error('Error starting block sync', error);
      throw error;
    }

    try {
      await this.autobidder.start(this.options.localRpcUrl);
    } catch (error) {
      console.error('Error starting autobidder', error);
      throw error;
    }

    this.isReady = true;
    this.isStarting = false;
  }

  public async stop() {
    await this.blockSync.stop();
    await this.autobidder.stop();
    await this.accountset.client.then(x => x.disconnect());
  }

  private async waitForDockersToSync() {
    console.log('Waiting for dockers to sync...');
    while (true) {
      const areDockersSynced = await this.areDockersSynced();
      if (areDockersSynced) break;

      console.log('Dockers are not synced, checking again in 1 second');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('Dockers are synced!');
  }

  private async areDockersSynced() {
    const argonBlockNumbers = await Dockers.getArgonBlockNumbers();
    if (!argonBlockNumbers.mainNode) return false;
    if (argonBlockNumbers.localNode < argonBlockNumbers.mainNode - 10) return false;

    const bitcoinBlockNumbers = await Dockers.getBitcoinBlockNumbers();
    if (!bitcoinBlockNumbers.mainNode) return false;
    if (bitcoinBlockNumbers.localNode < bitcoinBlockNumbers.mainNode - 1) return false;

    return true;
  }
}
