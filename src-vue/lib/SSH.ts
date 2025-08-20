import { Config } from './Config';
import { IConfigServerDetails } from '../interfaces/IConfig';
import { InvokeTimeout } from './tauriApi';
import { SSHConnection } from './SSHConnection';
import { IBiddingRules } from '@argonprotocol/commander-core';
import { Server } from './Server';

export interface ITryServerData {
  walletAddress: string | undefined;
  biddingRules: IBiddingRules | undefined;
  oldestFrameIdToSync: number | undefined;
}

export class SSH {
  private static connection?: SSHConnection;
  private static config: Config;

  public static setConfig(config: Config): void {
    this.config = config;
    if (this.connection) {
      void this.reconnect();
    }
  }

  public static async getIpAddress(): Promise<string> {
    await this.config.isLoadedPromise;
    return this.config.serverDetails.ipAddress;
  }

  public static async getConnection(): Promise<SSHConnection> {
    if (!this.connection) {
      await this.config.isLoadedPromise;
      this.connection = new SSHConnection({
        address: this.config.serverDetails.ipAddress,
        username: this.config.serverDetails.sshUser,
        privateKey: this.config.security.sshPrivateKey,
      });
      await this.connection.connect();
    }
    return this.connection;
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
    const server = new Server(connection);
    const [walletAddress] = await server.downloadAccountAddress();
    if (!walletAddress)
      return {
        walletAddress: undefined,
        biddingRules: undefined,
        oldestFrameIdToSync: undefined,
      };

    const biddingRules = await server.downloadBiddingRules();
    const { oldestFrameIdToSync } = await server.downloadEnvState();

    return {
      walletAddress,
      biddingRules,
      oldestFrameIdToSync,
    };
  }

  public static async runCommand(command: string, retries = 0): Promise<[string, number]> {
    const connection = await this.getConnection();
    try {
      const response = await connection.runCommandWithTimeout(command, 60 * 1e3);
      return response;
    } catch (e) {
      if (e instanceof InvokeTimeout) {
        console.error('SSH command timed out, retrying...', command);
        await this.reconnect();
        return this.runCommand(command, retries);
      }
      throw e;
    }
  }

  public static async uploadFile(contents: string, remotePath: string): Promise<void> {
    const connection = await this.getConnection();
    try {
      await connection.uploadFileWithTimeout(contents, remotePath, 60 * 1e3);
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
    const connection = await this.getConnection();
    await connection.uploadEmbeddedFileWithTimeout(localRelativePath, remotePath, progressCallback, 120 * 1e3);
  }

  public static async closeConnection(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = undefined;
    }
  }

  private static async reconnect(): Promise<void> {
    await this.connection?.close();
    await this.connection?.connect();
  }
}
