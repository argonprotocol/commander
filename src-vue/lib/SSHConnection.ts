import { invoke, invokeWithTimeout } from './tauriApi';
import { listen } from '@tauri-apps/api/event';

export interface ISSHConfig {
  address: string;
  username: string;
  privateKey?: string;
}

export class SSHConnection {
  public isConnected = false;
  public isConnectedPromise?: Promise<void>;

  public address: string;
  public host: string;
  public port: number;
  public username: string;
  public privateKey?: string;

  constructor(sshConfig: ISSHConfig) {
    const { host, port } = this.extractHostPort(sshConfig.address);
    this.address = sshConfig.address;
    this.host = host;
    this.port = port;
    this.username = sshConfig.username;
    this.privateKey = sshConfig.privateKey;
  }

  public async connect(): Promise<void> {
    if (this.isConnectedPromise) {
      return this.isConnectedPromise;
    }

    this.isConnectedPromise = new Promise(async (resolve, reject) => {
      const sshConfig = {
        address: this.address,
        host: this.host,
        port: this.port,
        username: this.username,
        privateKey: this.privateKey,
      };
      if (!sshConfig.host) {
        reject(new Error('No SSH host config provided'));
        return;
      }
      try {
        await invoke('open_ssh_connection', sshConfig);
      } catch (error) {
        reject(error);
        return;
      }
      this.isConnected = true;
      resolve();
      this.isConnectedPromise = undefined;
    });

    return this.isConnectedPromise;
  }

  public async runCommandWithTimeout(command: string, timeout: number, retries = 0): Promise<[string, number]> {
    try {
      const payload = { address: this.address, command };
      return await invokeWithTimeout('ssh_run_command', payload, timeout);
    } catch (e) {
      if (e === 'SSHCommandMissingExitStatus' && retries < 3) {
        console.error(`Failed to run command... retrying (${retries + 1}/3): % ${command}: ${e}`);
        return this.runCommandWithTimeout(command, timeout, retries + 1);
      }
      console.error(`Error running command ${command}`, e);
      throw e;
    }
  }

  public async uploadFileWithTimeout(contents: string, remotePath: string, timeout: number): Promise<void> {
    const payload = { address: this.address, contents, remotePath };
    return await invokeWithTimeout('ssh_upload_file', payload, timeout);
  }

  public async uploadEmbeddedFileWithTimeout(
    localRelativePath: string,
    remotePath: string,
    progressCallback: (progress: number) => void,
    timeout: number,
  ): Promise<void> {
    const eventProgressKey = localRelativePath.replace(/[^a-zA-Z0-9]/g, '_') + '_up_progress';
    const unsub = await listen(eventProgressKey, event => {
      progressCallback(event.payload as number);
      if (event.payload === 100) {
        unsub(); // Unsubscribe when upload is complete
      }
    });
    try {
      const payload = { address: this.address, localRelativePath, remotePath, eventProgressKey };
      await invokeWithTimeout('ssh_upload_embedded_file', payload, timeout);
    } catch (e) {
      unsub();
      throw e;
    }
  }

  public async downloadFileWithTimeout(
    remotePath: string,
    downloadPath: string,
    progressCallback: (progress: number) => void,
    timeout: number,
  ): Promise<void> {
    const eventProgressKey = remotePath.replace(/[^a-zA-Z0-9]/g, '_') + '_dl_progress';
    const unsub = await listen(eventProgressKey, event => {
      progressCallback(event.payload as number);
      if (event.payload === 100) {
        unsub(); // Unsubscribe when upload is complete
      }
    });
    try {
      const payload = { address: this.address, downloadPath, remotePath, eventProgressKey };
      await invokeWithTimeout('ssh_download_file', payload, timeout);
    } catch (e) {
      unsub();
      throw e;
    }
  }

  public async close(): Promise<void> {
    const payload = { address: this.address };
    await invokeWithTimeout('close_ssh_connection', payload, 5_000);
    this.isConnectedPromise = undefined;
    this.isConnected = false;
  }

  private extractHostPort(address: string): { host: string; port: number } {
    if (address.includes(':')) {
      const [host, port] = address.split(':');
      return { host, port: parseInt(port) };
    }
    return { host: address, port: 22 };
  }
}
