import { invoke } from '@tauri-apps/api/core';
import { Db } from './Db';
import { remove, BaseDirectory } from '@tauri-apps/plugin-fs';
import { AdvancedRestartOption } from '../interfaces/IAdvancedRestartOption';
import { SSH } from './SSH';
import { Server } from './Server';
import { InstallStepKey } from '../interfaces/IConfig.ts';
import { useConfig } from '../stores/config.ts';
import { toRaw } from 'vue';

export default class Restarter {
  private dbPromise: Promise<Db>;

  private _server?: Server;

  constructor(dbPromise: Promise<Db>) {
    this.dbPromise = dbPromise;
  }

  public async getServer() {
    if (!this._server) {
      const connection = await SSH.getOrCreateConnection();
      this._server = new Server(connection);
    }
    return this._server;
  }

  public async run(toRestart: Set<AdvancedRestartOption>) {
    if (toRestart.has(AdvancedRestartOption.CompletelyWipeAndReinstallCloudMachine)) {
      const server = await this.getServer();
      await server.completelyWipeEverything();
    } else {
      if (toRestart.has(AdvancedRestartOption.ResyncBitcoinBlocksOnCloudMachine)) {
        const server = await this.getServer();
        await server.resyncBitcoin();
      }

      if (toRestart.has(AdvancedRestartOption.ResyncArgonBlocksOnCloudMachine)) {
        const server = await this.getServer();
        await server.resyncMiner();
      }

      if (toRestart.has(AdvancedRestartOption.ResyncBiddingDataOnCloudMachine)) {
        const server = await this.getServer();
        await server.stopBotDocker();
        await server.deleteBotStorageFiles();
        await server.startBotDocker();
      }
    }

    if (toRestart.has(AdvancedRestartOption.RestartDockers)) {
      const server = await this.getServer();
      await server.restartDocker();
    }

    if (toRestart.has(AdvancedRestartOption.RecreateLocalDatabase)) {
      await this.recreateLocalDatabase();
    }

    if (toRestart.has(AdvancedRestartOption.ReloadAppUi)) {
      await this.restart();
    }
  }

  public async recreateLocalDatabase() {
    const db = await this.dbPromise;
    const config = useConfig();
    const serverDetails = toRaw(config.serverDetails);
    await db.close();

    const dbPath = Db.relativePath;
    await remove(dbPath, { baseDir: BaseDirectory.AppLocalData });
    await invoke('run_db_migrations');
    await db.reconnect();
    localStorage.setItem('ConfigRestore', JSON.stringify({ serverDetails: JSON.stringify(serverDetails) }));
  }

  public async restart() {
    window.location.reload();
  }
}
