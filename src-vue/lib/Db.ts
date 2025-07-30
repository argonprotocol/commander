import PluginSql, { QueryResult } from '@tauri-apps/plugin-sql';
import { CohortFramesTable } from './db/CohortFramesTable';
import { CohortsTable } from './db/CohortsTable';
import { ConfigTable } from './db/ConfigTable';
import { FramesTable } from './db/FramesTable';
import { ArgonActivitiesTable } from './db/ArgonActivitiesTable';
import { BitcoinActivitiesTable } from './db/BitcoinActivitiesTable';
import { BotActivitiesTable } from './db/BotActivitiesTable';
import { CohortAccountsTable } from './db/CohortAccountsTable';
import { INSTANCE_NAME, NETWORK_NAME } from './Config';
import { ensureOnlyOneInstance } from './Utils';
import { FrameBidsTable } from './db/FrameBidsTable';
import { VaultsTable } from './db/VaultsTable.ts';
import { BitcoinLocksTable } from './db/BitcoinLocksTable.ts';

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
  public frameBidsTable: FrameBidsTable;
  public vaultsTable: VaultsTable;
  public bitcoinLocksTable: BitcoinLocksTable;

  constructor(sql: PluginSql) {
    ensureOnlyOneInstance(this.constructor);

    this.sql = sql;
    this.argonActivitiesTable = new ArgonActivitiesTable(this);
    this.bitcoinActivitiesTable = new BitcoinActivitiesTable(this);
    this.botActivitiesTable = new BotActivitiesTable(this);
    this.cohortAccountsTable = new CohortAccountsTable(this);
    this.cohortFramesTable = new CohortFramesTable(this);
    this.cohortsTable = new CohortsTable(this);
    this.configTable = new ConfigTable(this);
    this.framesTable = new FramesTable(this);
    this.frameBidsTable = new FrameBidsTable(this);
    this.vaultsTable = new VaultsTable(this);
    this.bitcoinLocksTable = new BitcoinLocksTable(this);
  }

  static async load(): Promise<Db> {
    const sql = await PluginSql.load(`sqlite:${NETWORK_NAME}/${INSTANCE_NAME}/database.sqlite`);
    return new Db(sql);
  }

  async execute(query: string, bindValues?: unknown[]): Promise<QueryResult> {
    try {
      return await this.sql.execute(query, bindValues);
    } catch (error) {
      console.error('Error executing query:', { query, bindValues, error });
      throw error;
    }
  }

  async select<T>(query: string, bindValues?: unknown[]): Promise<T> {
    try {
      return await this.sql.select<T>(query, bindValues);
    } catch (error) {
      console.error('Error selecting query:', { query, bindValues, error });
      throw error;
    }
  }
}
