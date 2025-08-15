import { invoke } from '@tauri-apps/api/core';
import { Db } from './Db';
import { remove, BaseDirectory } from '@tauri-apps/plugin-fs';

export default class Restarter {
  private dbPromise: Promise<Db>;

  constructor(dbPromise: Promise<Db>) {
    this.dbPromise = dbPromise;
  }

  public async run() {
    this.recreateLocalDatabase();
    this.reloadAppUi();
  }

  public async reloadAppUi() {
    window.location.reload();
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
