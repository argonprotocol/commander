import { invoke } from '@tauri-apps/api/core';
import { Config, DEPLOY_ENV_FILE } from './Config';
import { IConfigServerDetails } from '../interfaces/IConfig';

export class SSH {
  private static config: Config;
  private static isConnected = false;

  public static setConfig(config: Config): void {
    this.config = config;
  }

  public static async tryConnection(serverDetails: IConfigServerDetails): Promise<void> {
    await invoke('try_ssh_connection', {
      host: serverDetails.ipAddress,
      username: serverDetails.sshUser,
      privateKey: serverDetails.sshPrivateKey,
    });
  }

  public static async closeConnection(): Promise<void> {
    await invoke('close_ssh_connection', {});
    this.isConnected = false;
  }

  public static async runHttpGet<T>(botPath: string, ...curlArgs: string[]): Promise<{ status: number; data: T }> {
    this.isConnected || (await this.openConnection());
    console.log(`Running: ~/scripts/get_bot_http.sh ${botPath} ${curlArgs.join(' ')}`);
    const result = await SSH.runCommand(`~/scripts/get_bot_http.sh ${botPath} ${curlArgs.join(' ')}`);
    if (result[1] !== 0) {
      throw new Error(`HTTP GET command failed with status ${result[1]}`);
    }

    const httpResponse: { status: number; data?: T; error?: string } = JSON.parse(result[0]);
    console.log('HTTP result:', httpResponse.data || httpResponse.error || httpResponse.status);

    if (httpResponse.status !== 200) {
      throw new Error(httpResponse.error);
    }

    return {
      status: httpResponse.status,
      data: httpResponse.data!,
    };
  }

  public static async runCommand(command: string, retries = 0): Promise<[string, number]> {
    this.isConnected || (await this.openConnection());
    try {
      const response = await invoke('ssh_run_command', { command });
      return response as [string, number];
    } catch (e) {
      if (e === 'SSHCommandMissingExitStatus' && retries < 2) {
        console.error(`Failed to run command... retrying (${retries + 1}/2): % ${command}: ${e}`);
        return this.runCommand(command, retries + 1);
      }
      throw e;
    }
  }

  public static async uploadFile(contents: string, remotePath: string): Promise<void> {
    this.isConnected || (await this.openConnection());
    await invoke('ssh_upload_file', { contents, remotePath });
  }

  public static async uploadDirectory(app: any, localRelativeDir: string, remoteDir: string): Promise<void> {
    this.isConnected || (await this.openConnection());
    await invoke('ssh_upload_directory', { app, localRelativeDir, remoteDir });
  }

  public static async stopMiningDockers(): Promise<void> {
    await this.runCommand(`cd deploy && docker compose --env-file=${DEPLOY_ENV_FILE} --profile miners down`);
  }

  public static async stopBotDocker(): Promise<void> {
    await this.runCommand(`cd deploy && docker compose --env-file=${DEPLOY_ENV_FILE} down bot`);
  }

  public static async startBotDocker(): Promise<void> {
    await this.runCommand(`cd deploy && docker compose --env-file=${DEPLOY_ENV_FILE} up bot -d`);
  }

  public static async getKeys(): Promise<IKeys> {
    const response = await invoke('get_ssh_keys', {});
    return response as IKeys;
  }

  // PRIVATE METHODS //////////////////////////////

  private static async openConnection(): Promise<void> {
    await this.config.isLoadedPromise;
    const sshConfig = {
      host: this.config.serverDetails.ipAddress,
      username: this.config.serverDetails.sshUser,
      privateKey: this.config.serverDetails.sshPrivateKey,
    };
    if (!sshConfig.host) {
      throw new Error('No SSH host config provided');
    }
    console.log('CREATING CONNECTION', sshConfig);
    await invoke('open_ssh_connection', sshConfig);
    this.isConnected = true;
  }
}

export interface IKeys {
  privateKey: string;
  publicKey: string;
}

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}
