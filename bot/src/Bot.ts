import { CohortStorage } from './storage.ts';
import {
  Accountset,
  getClient,
  type KeyringPair,
} from '@argonprotocol/mainchain';
import { AutoBidder } from './AutoBidder.ts';
import { BlockSync } from './BlockSync.ts';
import { Dockers } from './Dockers.ts';

export default class Bot {
  readonly autobidder: AutoBidder;
  readonly accountset: Accountset;
  readonly blockSync: BlockSync;
  readonly storage: CohortStorage;
  
  isStarting: boolean = false;
  isStarted: boolean = false;

  constructor(
    readonly options: {
      datadir: string;
      pair: KeyringPair;
      localRpcUrl: string;
      archiveRpcUrl: string;
      biddingRulesPath: string;
      keysMnemonic: string;
      oldestFrameIdToSync?: number;
    },
  ) {
    const client = getClient(options.localRpcUrl);
    this.storage = new CohortStorage(options.datadir, client);
    this.accountset = new Accountset({
      client,
      seedAccount: options.pair,
      sessionKeyMnemonic: options.keysMnemonic,
      subaccountRange: new Array(99).fill(0).map((_, i) => i),
    });
    this.autobidder = new AutoBidder(
      this.accountset,
      this.storage,
      options.biddingRulesPath,
    );
    this.blockSync = new BlockSync(
      this.accountset,
      this.storage,
      options.archiveRpcUrl,
      options.oldestFrameIdToSync,
    );
  }

  async currentFrameId() {
    const state = await this.storage.syncStateFile().get();
    return state?.currentFrameId ?? 0;
  }

  async areDockersSynced() {
    const argonBlockNumbers = await Dockers.getArgonBlockNumbers();
    if (argonBlockNumbers[0] < argonBlockNumbers[1]) return false;

    const bitcoinBlockNumbers = await Dockers.getBitcoinBlockNumbers();
    if (bitcoinBlockNumbers[0] < bitcoinBlockNumbers[1]) return false;

    return true;
  }

  async startAfterDockersSynced() {
    if (this.isStarting || this.isStarted) return;
    this.isStarting = true;

    while (true) {
      const dockersAreSynced = await this.areDockersSynced();
      if (dockersAreSynced) break;

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await this.start();
  }

  async start() {
    this.isStarting = true;

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
}
