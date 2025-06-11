import { CohortStorage } from './storage.ts';
import {
  Accountset,
  getClient,
  type KeyringPair,
} from '@argonprotocol/mainchain';
import { AutoBidder } from './AutoBidder.ts';
import { BlockSync } from './BlockSync.ts';
import { Dockers } from './Dockers.ts';

interface IBotOptions {
  datadir: string;
  pair: KeyringPair;
  localRpcUrl: string;
  archiveRpcUrl: string;
  biddingRulesPath: string;
  keysMnemonic: string;
  oldestFrameIdToSync?: number;
}

export default class Bot {
  public autobidder!: AutoBidder;
  public accountset!: Accountset;
  public blockSync!: BlockSync;
  public storage!: CohortStorage;
  
  public isInitialized: boolean = false;
  public isWaitingToStart: boolean = false;
  public isStarting: boolean = false;
  public isStarted: boolean = false;

  private options: IBotOptions;

  constructor(
    options: IBotOptions,
  ) {
    this.options = options;
  }

  private init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    const client = getClient(this.options.localRpcUrl);
    this.storage = new CohortStorage(this.options.datadir, client);
    this.accountset = new Accountset({
      client,
      seedAccount: this.options.pair,
      sessionKeyMnemonic: this.options.keysMnemonic,
      subaccountRange: new Array(99).fill(0).map((_, i) => i),
    });
    this.autobidder = new AutoBidder(
      this.accountset,
      this.storage,
      this.options.biddingRulesPath,
    );
    this.blockSync = new BlockSync(
      this,
      this.accountset,
      this.storage,
      this.options.archiveRpcUrl,
      this.options.oldestFrameIdToSync,
    );
  }

  async currentFrameId() {
    const state = await this.storage.syncStateFile().get();
    return state?.currentFrameId ?? 0;
  }

  async startAfterDockersSynced() {
    if (this.isWaitingToStart || this.isStarting || this.isStarted) return;
    this.isWaitingToStart = true;

    console.log('Waiting for dockers to sync...');
    while (true) {
      const dockersAreSynced = await this.areDockersSynced();
      if (dockersAreSynced) break;

      console.log('Dockers are not synced, waiting 1 second');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const argonBlockNumbers = await Dockers.getArgonBlockNumbers();
    const bitcoinBlockNumbers = await Dockers.getBitcoinBlockNumbers();
    console.log('Dockers are synced, starting bot', { argonBlockNumbers, bitcoinBlockNumbers });
    
    this.isWaitingToStart = false;
    await this.start();
  }

  async start() {
    if (this.isStarting || this.isStarted) return;
    this.isStarting = true;

    this.init();

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
    
    this.isStarting = false;
    this.isStarted = true;
    
    const status = await this.blockSync.status();
    console.log('Block sync updated', status);
    
    return status;
  }

  async stop() {
    await this.blockSync.stop();
    await this.autobidder.stop();
    await this.accountset.client.then(x => x.disconnect());
  }
  
  private async areDockersSynced() {
    const argonBlockNumbers = await Dockers.getArgonBlockNumbers();
    if (argonBlockNumbers.localNode < argonBlockNumbers.mainNode) return false;

    const bitcoinBlockNumbers = await Dockers.getBitcoinBlockNumbers();
    if (bitcoinBlockNumbers.localNode < bitcoinBlockNumbers.mainNode) return false;

    return true;
  }
}
