import { jsonParseWithBigInts } from '@argonprotocol/commander-core';
import { type Config } from './Config';
import Restarter from './Restarter';
import { Db } from './Db';
import { invokeWithTimeout } from './tauriApi';
import { SSH } from './SSH';

export default class Importer {
  private onFinished: () => void;
  private data: any = {};
  private config: Config;
  private dbPromise: Promise<Db>;
  public failureToReadData: boolean;

  constructor(config: Config, dbPromise: Promise<Db>, onFinished: () => void) {
    this.config = config;
    this.dbPromise = dbPromise;
    this.onFinished = onFinished;

    this.failureToReadData = false;
  }

  async importFromFile(dataRaw: string) {
    try {
      this.data = jsonParseWithBigInts(dataRaw);
    } catch (error) {
      console.error(error);
      this.failureToReadData = true;
      return;
    }

    const restarter = new Restarter(this.dbPromise);
    await restarter.recreateLocalDatabase();
    await invokeWithTimeout('overwrite_security', { ...this.data.security }, 10_000);
    await this.config.load();

    this.config.oldestFrameIdToSync = this.data.oldestFrameIdToSync ?? this.config.oldestFrameIdToSync;
    this.config.defaultCurrencyKey = this.data.defaultCurrencyKey ?? this.config.defaultCurrencyKey;
    this.config.requiresPassword = this.data.requiresPassword ?? this.config.requiresPassword;
    this.config.userJurisdiction = this.data.userJurisdiction ?? this.config.userJurisdiction;
    if (!this.data.serverDetails?.ipAddress) return;

    this.config.serverDetails = this.data.serverDetails;
    const serverData = await this.fetchServerData();

    if (serverData?.walletAddress !== this.config.miningAccount.address) {
      throw new Error('Wallet address mismatch');
    }

    if (serverData.biddingRules) {
      this.config.biddingRules = serverData.biddingRules;
    }
    this.config.oldestFrameIdToSync = serverData.oldestFrameIdToSync ?? this.config.oldestFrameIdToSync;
    await this.config.save();

    this.onFinished();
  }

  async importFromMnemonic(mnemonic: string) {
    const restarter = new Restarter(this.dbPromise);
    await invokeWithTimeout('overwrite_mnemonic', { mnemonic }, 10_000);
    await restarter.recreateLocalDatabase();
    await restarter.restart();
    this.onFinished();
  }

  private async fetchServerData() {
    const serverDetails = this.data.serverDetails;
    const security = this.data.security;
    if (!serverDetails.ipAddress || !security.sshPrivateKey) return;

    const serverData = await SSH.tryConnection(serverDetails, security.sshPrivateKey);
    return serverData;
  }
}
