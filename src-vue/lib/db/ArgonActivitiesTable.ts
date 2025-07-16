import { Db } from '../Db';
import { IArgonActivityRecord } from '../../interfaces/db/IArgonActivityRecord';

export class ArgonActivitiesTable {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async insert(localhostBlock: number, mainchainBlock: number): Promise<IArgonActivityRecord> {
    const [rawRecord] = await this.db.sql.select<IArgonActivityRecord[]>(
      'INSERT INTO argon_activities (localNodeBlockNumber, mainNodeBlockNumber) VALUES (?1, ?2) RETURNING *',
      [localhostBlock, mainchainBlock],
    );
    return rawRecord;
  }

  async latest(): Promise<IArgonActivityRecord | null> {
    const rawRecords = await this.db.sql.select<IArgonActivityRecord[]>(
      'SELECT * FROM argon_activities ORDER BY insertedAt DESC LIMIT 1',
      [],
    );
    return rawRecords[0];
  }

  async fetchLastFiveRecords(): Promise<IArgonActivityRecord[]> {
    return await this.db.sql.select<IArgonActivityRecord[]>(
      'SELECT * FROM argon_activities ORDER BY insertedAt DESC LIMIT 5',
      [],
    );
  }
}
