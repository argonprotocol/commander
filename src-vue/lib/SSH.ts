import { invoke } from '@tauri-apps/api/core';
import { Config, DEPLOY_ENV_FILE } from './Config';
import { IConfigServerDetails } from '../interfaces/IConfig';
import { listen } from '@tauri-apps/api/event';

class InvokeTimeout extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class SSH {
  private static config: Config;
  private static isConnected = false;
  private static isConnectingPromise?: Promise<void>;

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

  public static get ipAddress() {
    return this.config.serverDetails.ipAddress;
  }

  public static async runCommand(command: string, retries = 0): Promise<[string, number]> {
    this.isConnected || (await this.openConnection());
    try {
      const response = await this.invokeWithTimeout('ssh_run_command', { command }, 60 * 1e3);
      return response as [string, number];
    } catch (e) {
      if (e instanceof InvokeTimeout) {
        console.error('SSH command timed out, retrying...', command);
        await this.closeConnection();
        return this.runCommand(command, retries);
      }
      if (e === 'SSHCommandMissingExitStatus' && retries < 2) {
        console.error(`Failed to run command... retrying (${retries + 1}/2): % ${command}: ${e}`);
        return this.runCommand(command, retries + 1);
      }
      throw e;
    }
  }

  public static async getEmbeddedFiles(path: string): Promise<string[]> {
    const response = await this.invokeWithTimeout('get_embedded_files', { path }, 2 * 1e3);
    return response as string[];
  }

  public static async uploadFile(contents: string, remotePath: string): Promise<void> {
    this.isConnected || (await this.openConnection());
    try {
      await this.invokeWithTimeout('ssh_upload_file', { contents, remotePath }, 60 * 1e3);
    } catch (e) {
      if (e instanceof InvokeTimeout) {
        await this.closeConnection();
        return this.uploadFile(contents, remotePath);
      }
      throw e;
    }
  }

  public static async uploadEmbeddedFile(
    app: any,
    localPath: string,
    remotePath: string,
    progressCallback: (progress: number) => void,
  ): Promise<void> {
    this.isConnected || (await this.openConnection());
    const eventProgressKey = localPath.replace(/[^a-zA-Z0-9]/g, '_') + '_progress';
    const unsub = await listen(eventProgressKey, event => {
      progressCallback(event.payload as number);
      if (event.payload === 100) {
        unsub(); // Unsubscribe when upload is complete
      }
    });
    try {
      await this.invokeWithTimeout(
        'ssh_upload_embedded_file',
        { app, localPath, remotePath, eventProgressKey },
        120 * 1e3,
      );
    } catch (e) {
      unsub();
      throw e;
    }
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

  public static async getKeys(): Promise<IKeys> {
    const response = await invoke('get_ssh_keys', {});
    return response as IKeys;
  }

  // PRIVATE METHODS //////////////////////////////

  private static invokeWithTimeout<T>(cmd: string, args: Record<string, any>, timeoutMs: number): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new InvokeTimeout('Invoke timed out')), timeoutMs),
    );

    const invocation = invoke<T>(cmd, args);

    return Promise.race([invocation, timeout]);
  }

  private static async openConnection(): Promise<void> {
    if (this.isConnectingPromise) {
      return this.isConnectingPromise;
    }

    this.isConnectingPromise = new Promise(async resolve => {
      await this.config.isLoadedPromise;
      const sshConfig = {
        host: this.config.serverDetails.ipAddress,
        username: this.config.serverDetails.sshUser,
        privateKey: this.config.serverDetails.sshPrivateKey,
      };
      if (!sshConfig.host) {
        throw new Error('No SSH host config provided');
      }
      await invoke('open_ssh_connection', sshConfig);
      this.isConnected = true;
      resolve();
      this.isConnectingPromise = undefined;
    });

    return this.isConnectingPromise;
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
