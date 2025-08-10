import { Config, DEPLOY_ENV_FILE } from './Config';
import { IConfigServerDetails } from '../interfaces/IConfig';
import { invoke, InvokeTimeout, invokeWithTimeout } from './tauriApi';
import SSHConnection from './SSHConnection';
import { SSHCommands } from './SSHCommands';
import dotenv from 'dotenv';
import { IBiddingRules, jsonParseWithBigInts } from '@argonprotocol/commander-calculator';
import { listen } from '@tauri-apps/api/event';

export interface ITryServerData {
  walletAddress: string | undefined;
  biddingRules: IBiddingRules | undefined;
  oldestFrameIdToSync: number | undefined;
}

export class SSH {
  private static config: Config;
  private static connection: SSHConnection;

  public static setConfig(config: Config): void {
    this.config = config;
    if (this.connection) {
      this.reconnect();
    }
  }

  public static async tryConnection(
    serverDetails: IConfigServerDetails,
    sshPrivateKey: string,
  ): Promise<ITryServerData> {
    const connection = new SSHConnection({
      address: serverDetails.ipAddress,
      username: serverDetails.sshUser,
      privateKey: sshPrivateKey,
    });
    await connection.connect();
    const [walletAddress] = await connection.runCommandWithTimeout(SSHCommands.fetchUploadedWalletAddress, 10_000);
    if (!walletAddress)
      return {
        walletAddress: undefined,
        biddingRules: undefined,
        oldestFrameIdToSync: undefined,
      };

    const [biddingRulesRaw] = await connection.runCommandWithTimeout(SSHCommands.fetchBiddingRules, 10_000);
    const biddingRules = biddingRulesRaw ? jsonParseWithBigInts(biddingRulesRaw) : undefined;
    const [envState] = await connection.runCommandWithTimeout(SSHCommands.fetchEnvState, 10_000);
    const parsedEnvState = envState ? dotenv.parse(envState) : {};
    const oldestFrameIdToSync = Number(parsedEnvState.OLDEST_FRAME_ID_TO_SYNC);

    return {
      walletAddress,
      biddingRules,
      oldestFrameIdToSync,
    };
  }

  public static get ipAddress() {
    return this.config.serverDetails.ipAddress;
  }

  public static async runCommand(command: string, retries = 0): Promise<[string, number]> {
    this.connection?.isConnected || (await this.connect());
    try {
      const response = await this.connection.runCommandWithTimeout(command, 60 * 1e3);
      return response as [string, number];
    } catch (e) {
      if (e instanceof InvokeTimeout) {
        console.error('SSH command timed out, retrying...', command);
        await this.reconnect();
        return this.runCommand(command, retries);
      }
      if (e === 'SSHCommandMissingExitStatus' && retries < 2) {
        console.error(`Failed to run command... retrying (${retries + 1}/2): % ${command}: ${e}`);
        return this.runCommand(command, retries + 1);
      }
      throw e;
    }
  }

  public static async uploadFile(contents: string, remotePath: string): Promise<void> {
    this.connection?.isConnected || (await this.connect());
    try {
      await this.connection.uploadFileWithTimeout(contents, remotePath, 60 * 1e3);
    } catch (e) {
      if (e instanceof InvokeTimeout) {
        await this.reconnect();
        return this.uploadFile(contents, remotePath);
      }
      throw e;
    }
  }

  public static async uploadEmbeddedFile(
    localRelativePath: string,
    remotePath: string,
    progressCallback: (progress: number) => void,
  ): Promise<void> {
    this.connection?.isConnected || (await this.connect());
    await this.connection.uploadEmbeddedFileWithTimeout(localRelativePath, remotePath, progressCallback, 120 * 1e3);
  }

  public static async stopMiningDockers(): Promise<void> {
    await this.runCommand(`cd server && docker compose --env-file=${DEPLOY_ENV_FILE} --profile miners down`);
  }

  public static async stopBotDocker(): Promise<void> {
    await this.runCommand(`cd server && docker compose --env-file=${DEPLOY_ENV_FILE} down bot`);
  }

  public static async startBotDocker(): Promise<void> {
    await this.runCommand(`cd server && docker compose --env-file=${DEPLOY_ENV_FILE} up bot -d`);
  }

  private static async connect(): Promise<void> {
    if (this.connection) {
      return this.connection.isConnectedPromise;
    }
    await this.config.isLoadedPromise;
    this.connection = new SSHConnection({
      address: this.config.serverDetails.ipAddress,
      username: this.config.serverDetails.sshUser,
      privateKey: this.config.security.sshPrivateKey,
    });
    await this.connection.connect();
  }

  private static async reconnect(): Promise<void> {
    await this.connection.close();
    await this.connection.connect();
  }
}
