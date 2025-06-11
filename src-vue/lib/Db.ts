import PluginSql from '@tauri-apps/plugin-sql';
import { CohortFramesTable } from './db/CohortFramesTable';
import { CohortsTable } from './db/CohortsTable';
import { ConfigTable } from './db/ConfigTable';
import { FramesTable } from './db/FramesTable';
import { ArgonActivitiesTable } from './db/ArgonActivitiesTable';
import { BitcoinActivitiesTable } from './db/BitcoinActivitiesTable';
import { BotActivitiesTable } from './db/BotActivitiesTable';
import { CohortAccountsTable } from './db/CohortAccountsTable';
import { INSTANCE_NAME } from './Config';

export class Db {
  public sql: PluginSql;
  public argonActivitiesTable: ArgonActivitiesTable;
  public bitcoinActivitiesTable: BitcoinActivitiesTable;
  public botActivitiesTable: BotActivitiesTable;
  public cohortAccountsTable: CohortAccountsTable;
  public cohortFramesTable: CohortFramesTable;
  public cohortsTable: CohortsTable;
  public configTable: ConfigTable;
  public framesTable: FramesTable;

  constructor(sql: PluginSql) {
    this.sql = sql;
    this.argonActivitiesTable = new ArgonActivitiesTable(this);
    this.bitcoinActivitiesTable = new BitcoinActivitiesTable(this);
    this.botActivitiesTable = new BotActivitiesTable(this);
    this.cohortAccountsTable = new CohortAccountsTable(this);
    this.cohortFramesTable = new CohortFramesTable(this);
    this.cohortsTable = new CohortsTable(this);
    this.configTable = new ConfigTable(this);
    this.framesTable = new FramesTable(this);
  }

  static async load(): Promise<Db> {
    const sql = await PluginSql.load(`sqlite:${INSTANCE_NAME}/database.sqlite`);
    return new Db(sql);
  }
}