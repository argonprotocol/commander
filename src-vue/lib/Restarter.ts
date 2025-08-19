import { invoke } from '@tauri-apps/api/core';
import { Db } from './Db';
import { remove, BaseDirectory } from '@tauri-apps/plugin-fs';
import { Option } from '../../src-vue/overlays/troubleshooting/AdvancedRestart.vue';
import { SSH } from './SSH';
import { Server } from './Server';

export default class Restarter {
  private dbPromise: Promise<Db>;

  private _server?: Server;

  constructor(dbPromise: Promise<Db>) {
    this.dbPromise = dbPromise;
  }

  public async getServer() {
    if (!this._server) {
      const connection = await SSH.getConnection();
      this._server = new Server(connection);
    }
    return this._server;
  }

  public async run(toRestart: Set<Option>) {
    if (toRestart.has(Option.CompletelyWipeAndReinstallCloudMachine)) {
      const server = await this.getServer();
      await server.completelyWipeEverything();
    }

    if (toRestart.has(Option.RecreateLocalDatabase)) {
      await this.recreateLocalDatabase();
    }

    if (toRestart.has(Option.ReloadAppUi)) {
      window.location.reload();
    }
  }

  public async recreateLocalDatabase() {
    const db = await this.dbPromise;
    await db.close();

    const dbPath = Db.relativePath;
    await remove(dbPath, { baseDir: BaseDirectory.AppLocalData });
    await invoke('run_db_migrations');
    await db.reconnect();
  }
}
