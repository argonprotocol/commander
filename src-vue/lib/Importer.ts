import { JsonExt } from '@argonprotocol/commander-core';
import { type Config } from './Config';
import Restarter from './Restarter';
import { Db } from './Db';
import { invokeWithTimeout } from './tauriApi';
import { ITryServerData, SSH } from './SSH';
import { IConfigServerDetails } from '../interfaces/IConfig';
import { IRecoveryFile } from '../interfaces/IRecoveryFile.ts';

export default class Importer {
  private onFinished?: () => void;
  private data!: IRecoveryFile;
  private config: Config;
  private dbPromise: Promise<Db>;

  public failureToReadData: boolean;

  constructor(config: Config, dbPromise: Promise<Db>, onFinished?: () => void) {
    this.config = config;
    this.dbPromise = dbPromise;
    this.onFinished = onFinished;

    this.failureToReadData = false;
  }

  async importFromFile(dataRaw: string) {
    try {
      this.data = JsonExt.parse(dataRaw);
    } catch (error) {
      console.error(error);
      this.failureToReadData = true;
      return;
    }

    const restarter = new Restarter(this.dbPromise, this.config);
    await restarter.recreateLocalDatabase();
    await invokeWithTimeout('overwrite_security', { ...this.data.security }, 10_000);
    await this.config.load(true);

    this.config.oldestFrameIdToSync = this.data.oldestFrameIdToSync ?? this.config.oldestFrameIdToSync;
    this.config.defaultCurrencyKey = this.data.defaultCurrencyKey ?? this.config.defaultCurrencyKey;
    this.config.requiresPassword = this.data.requiresPassword ?? this.config.requiresPassword;
    this.config.userJurisdiction = this.data.userJurisdiction ?? this.config.userJurisdiction;
    if (this.data.vaultingRules) {
      this.config.vaultingRules = this.data.vaultingRules;
    }
    if (this.data.serverDetails?.ipAddress) {
      this.config.serverDetails = this.data.serverDetails;
      const serverData = await this.fetchServerData(this.data.serverDetails, this.data.security.sshPrivateKeyPath);

      if (serverData?.walletAddress !== this.config.miningAccount.address) {
        throw new Error('Wallet address mismatch');
      }

      if (serverData.biddingRules) {
        this.config.biddingRules = serverData.biddingRules;
      }

      this.config.oldestFrameIdToSync = serverData.oldestFrameIdToSync ?? this.config.oldestFrameIdToSync;
    }
    await this.config.save();

    this.onFinished?.();
  }

  async importFromMnemonic(mnemonic: string) {
    const restarter = new Restarter(this.dbPromise, this.config);
    await invokeWithTimeout('overwrite_mnemonic', { mnemonic }, 10_000);
    await restarter.recreateLocalDatabase(true);
    this.onFinished?.();
  }

  async importFromServer(ipAddress: string) {
    const serverDetails: IConfigServerDetails = {
      ipAddress,
      sshUser: this.config.serverDetails.sshUser,
      type: this.config.serverDetails.type,
      workDir: this.config.serverDetails.workDir,
      port: this.config.serverDetails.port,
    };

    const serverData = await this.fetchServerData(serverDetails, this.config.security.sshPrivateKeyPath);

    if (!serverData) {
      throw new Error('Failed to fetch server data');
    } else if (serverData.walletAddress !== this.config.miningAccount.address) {
      throw new Error('Wallet address mismatch');
    }

    // TODO: We might want to return this data to the caller (BotCreateOverlay) so they can hold it in case the user
    // wants to click the Cancel button.
    this.config.biddingRules = serverData.biddingRules!;
    this.config.oldestFrameIdToSync = serverData.oldestFrameIdToSync!;
    this.config.serverDetails = { ...this.config.serverDetails, ipAddress: ipAddress };
    this.config.isMinerInstalled = true;
    await this.config.save();

    this.onFinished?.();
  }

  private async fetchServerData(
    serverDetails: IConfigServerDetails,
    sshPrivateKeyPath: string,
  ): Promise<ITryServerData | undefined> {
    if (!serverDetails.ipAddress || !sshPrivateKeyPath) return;

    const serverData = await SSH.tryConnection(serverDetails, sshPrivateKeyPath);
    return serverData;
  }
}
