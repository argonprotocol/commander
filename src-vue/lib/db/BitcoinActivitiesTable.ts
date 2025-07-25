import { BaseTable } from './BaseTable';
import { IBitcoinActivityRecord } from '../../interfaces/db/IBitcoinActivityRecord';

export class BitcoinActivitiesTable extends BaseTable {
  async insert(
    frameId: number,
    localNodeBlockNumber: number,
    mainNodeBlockNumber: number,
  ): Promise<IBitcoinActivityRecord> {
    const records = await this.db.select<IBitcoinActivityRecord[]>(
      'INSERT INTO BitcoinActivities (frameId, localNodeBlockNumber, mainNodeBlockNumber) VALUES (?1, ?2, ?3) RETURNING *',
      [frameId, localNodeBlockNumber, mainNodeBlockNumber],
    );
    return records[0];
  }

  async latest(): Promise<IBitcoinActivityRecord | null> {
    const records = await this.db.select<IBitcoinActivityRecord[]>(
      'SELECT * FROM BitcoinActivities ORDER BY insertedAt DESC LIMIT 1',
      [],
    );
    return records[0];
  }

  async fetchLastFiveRecords(): Promise<IBitcoinActivityRecord[]> {
    return await this.db.select<IBitcoinActivityRecord[]>(
      'SELECT * FROM BitcoinActivities ORDER BY insertedAt DESC LIMIT 5',
      [],
    );
  }
}
