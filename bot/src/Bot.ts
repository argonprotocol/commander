import * as Fs from 'node:fs';
import { Accountset, type ArgonClient, type KeyringPair } from '@argonprotocol/mainchain';
import { getClient } from './utils.ts';
import { Storage } from './storage.ts';
import { AutoBidder } from './AutoBidder.ts';
import { BlockSync } from './BlockSync.ts';
import { Dockers } from './Dockers.ts';
import { type IBiddingRules, jsonParseWithBigInts } from '@argonprotocol/commander-calculator';
import { History } from './History.ts';

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
  public storage!: Storage;

  public isStarting: boolean = false;
  public isWaitingForBiddingRules: boolean = false;
  public isSyncing: boolean = false;
  public isReady: boolean = false;

  public history!: History;

  private options: IBotOptions;
  private biddingRules: IBiddingRules | null = null;
  private localClient!: ArgonClient;
  private archiveClient!: ArgonClient;

  constructor(options: IBotOptions) {
    this.options = options;
  }

  public get currentFrameId(): Promise<number> {
    return new Promise(async (resolve, reject) => {
      try {
        const state = await this.storage.botStateFile().get();
        resolve(state?.currentFrameId ?? 0);
      } catch (error) {
        reject(error);
      }
    });
  }

  public async start(): Promise<void> {
    if (this.isStarting || this.isReady) return;
    this.isStarting = true;
    console.log('STARTING BOT');

    this.storage = new Storage(this.options.datadir);
    this.history = new History(this.storage);
    this.history.handleStarting();

    this.options.shouldSkipDockerSync || (await this.waitForDockerConfirmation());
    this.history.handleDockersConfirmed();
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('CONNECTING TO LOCAL RPC');
    const localClientPromise = getClient(this.options.localRpcUrl);
    try {
      this.localClient = await localClientPromise;
    } catch (error) {
      console.error('Error initializing local client', error);
      throw error;
    }

    const archiveClientPromise = getClient(this.options.archiveRpcUrl);
    try {
      this.archiveClient = await archiveClientPromise;
    } catch (error) {
      console.error('Error initializing archive client', error);
      throw error;
    }

    this.biddingRules = this.loadBiddingRules();
    this.accountset = new Accountset({
      client: localClientPromise,
      seedAccount: this.options.pair,
      sessionKeyMnemonic: this.options.keysMnemonic,
      subaccountRange: new Array(99).fill(0).map((_, i) => i),
    });
    this.autobidder = new AutoBidder(
      this.accountset,
      this.storage,
      this.history,
      this.biddingRules || ({} as IBiddingRules),
    );
    this.blockSync = new BlockSync(
      this,
      this.autobidder,
      this.accountset,
      this.storage,
      this.localClient,
      this.archiveClient,
      this.options.oldestFrameIdToSync,
    );

    this.isSyncing = true;
    this.history.handleStartedSyncing();
    while (true) {
      try {
        await this.blockSync.load();
        break;
      } catch (error) {
        console.error('Error loading block sync (retrying...)', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    this.history.handleFinishedSyncing();
    this.isSyncing = false;

    if (!this.biddingRules) {
      console.log('No bidding rules were found, cannot finish loading');
      this.isWaitingForBiddingRules = true;
      return;
    }

    console.log('Starting block sync');
    while (true) {
      try {
        this.history.handleReady();
        await this.blockSync.start();
        break;
      } catch (error) {
        console.error('Error starting block sync (retrying...)', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('Starting autobidder');

    try {
      await this.autobidder.start(this.options.localRpcUrl);
    } catch (error) {
      console.error('Error starting autobidder', error);
      throw error;
    }

    this.isReady = true;
    this.isStarting = false;
  }

  public async shutdown() {
    this.history.handleShutdown();
    await this.blockSync.stop();
    await this.autobidder.stop();
    await this.accountset.client.then(x => x.disconnect());
  }

  private loadBiddingRules() {
    const rawJsonString = Fs.readFileSync(this.options.biddingRulesPath, 'utf8');
    return jsonParseWithBigInts(rawJsonString);
  }

  private async waitForDockerConfirmation() {
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
    const bitcoinBlockNumbers = await Dockers.getBitcoinBlockNumbers();
    if (!bitcoinBlockNumbers.mainNode) return false;
    if (bitcoinBlockNumbers.localNode < bitcoinBlockNumbers.mainNode - 1) return false;

    const argonBlockNumbers = await Dockers.getArgonBlockNumbers();
    if (!argonBlockNumbers.mainNode) return false;
    if (argonBlockNumbers.localNode < argonBlockNumbers.mainNode - 10) return false;

    const isArgonMinerReady = await Dockers.isArgonMinerReady();
    if (!isArgonMinerReady) return false;

    return true;
  }
}
