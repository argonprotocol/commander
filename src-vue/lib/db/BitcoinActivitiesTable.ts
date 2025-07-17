import { BaseTable } from './BaseTable';
import { IBitcoinActivityRecord } from '../../interfaces/db/IBitcoinActivityRecord';

export class BitcoinActivitiesTable extends BaseTable {
  async insert(localNodeBlockNumber: number, mainNodeBlockNumber: number): Promise<IBitcoinActivityRecord> {
    const records = await this.db.sql.select<IBitcoinActivityRecord[]>(
      'INSERT INTO BitcoinActivities (localNodeBlockNumber, mainNodeBlockNumber) VALUES (?1, ?2) RETURNING *',
      [localNodeBlockNumber, mainNodeBlockNumber],
    );
    return records[0];
  }

  async latest(): Promise<IBitcoinActivityRecord | null> {
    const records = await this.db.sql.select<IBitcoinActivityRecord[]>(
      'SELECT * FROM BitcoinActivities ORDER BY insertedAt DESC LIMIT 1',
      [],
    );
    return records[0];
  }

  async fetchLastFiveRecords(): Promise<IBitcoinActivityRecord[]> {
    return await this.db.sql.select<IBitcoinActivityRecord[]>(
      'SELECT * FROM BitcoinActivities ORDER BY insertedAt DESC LIMIT 5',
      [],
    );
  }
}
