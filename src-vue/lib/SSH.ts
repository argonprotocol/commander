import { invoke } from "@tauri-apps/api/core";
import { Config } from "./Config";
import { IConfigServerDetails } from "../interfaces/IConfig";


export class SSH {
  public static async tryConnection(serverDetails: IConfigServerDetails): Promise<number> {
    return await invoke('try_ssh_connection', {
      host: serverDetails.ipAddress,
      username: serverDetails.sshUser,
      privateKey: serverDetails.sshPrivateKey,
    });
  }

  public static async closeConnection(): Promise<void> {
    await invoke('close_ssh_connection', {});
  }

  public static async ensureConnection(serverDetails: IConfigServerDetails): Promise<number> {
    return await invoke('ensure_ssh_connection', {
      host: serverDetails.ipAddress,
      username: serverDetails.sshUser,
      privateKey: serverDetails.sshPrivateKey,
    });
  }

  public static async ensureTunnel(serverDetails: IConfigServerDetails): Promise<number> {
    return await invoke('ensure_ssh_tunnel', {
      host: serverDetails.ipAddress,
      username: serverDetails.sshUser,
      privateKey: serverDetails.sshPrivateKey,
    });
  }

  public static async runCommand(command: string): Promise<[string, number]> {
    try {
      const response = await invoke('ssh_run_command', { command });
      return response as [string, number];
    } catch (e) {
      console.error(`Failed to run command (${command}): ${e}`);
      throw e;
    }
  }

  public static async uploadFile(contents: string, remotePath: string): Promise<void> {
    await invoke('ssh_upload_file', { contents, remotePath });
  }

  public static async uploadDirectory(app: any, localRelativeDir: string, remoteDir: string): Promise<void> {
    await invoke('ssh_upload_directory', { app, localRelativeDir, remoteDir });
  }

  // STATIC METHODS //////////////////////////////

  public static async getKeys(): Promise<IKeys> {
    const response = await invoke('get_ssh_keys', {});
    return response as IKeys;
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