import camelcaseKeys from 'camelcase-keys';
import { Db } from '../Db';

interface IArgonActivityRecord {
  localNodeBlockNumber: number;
  mainNodeBlockNumber: number;
  insertedAt: string;
}

export class ArgonActivitiesTable {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async insert(localhostBlock: number, mainchainBlock: number): Promise<IArgonActivityRecord> {
    const [rawRecord] = await this.db.sql.select<[any]>(
      'INSERT INTO argon_activities (local_node_block_number, main_node_block_number) VALUES (?1, ?2) RETURNING *',
      [localhostBlock, mainchainBlock],
    );
    return camelcaseKeys(rawRecord) as IArgonActivityRecord;
  }

  async latest(): Promise<IArgonActivityRecord | null> {
    const rawRecords = await this.db.sql.select<any[]>(
      'SELECT * FROM argon_activities ORDER BY inserted_at DESC LIMIT 1',
      [],
    );
    return rawRecords[0] ? (camelcaseKeys(rawRecords[0]) as IArgonActivityRecord) : null;
  }

  async fetchLastFiveRecords(): Promise<IArgonActivityRecord[]> {
    const rawRecords = await this.db.sql.select<any[]>(
      'SELECT * FROM argon_activities ORDER BY inserted_at DESC LIMIT 5',
      [],
    );
    return camelcaseKeys(rawRecords) as IArgonActivityRecord[];
  }
}
