import { BaseTable } from './BaseTable';

interface IBitcoinActivityRecord {
  localNodeBlockNumber: number;
  mainNodeBlockNumber: number;
  insertedAt: string;
}

export class BitcoinActivitiesTable extends BaseTable {
  async insert(
    localNodeBlockNumber: number,
    mainNodeBlockNumber: number,
  ): Promise<IBitcoinActivityRecord> {
    const [record] = await this.db.sql.select<IBitcoinActivityRecord[]>(
      'INSERT INTO bitcoin_activities (local_node_block_number, main_node_block_number) VALUES (?1, ?2) RETURNING *',
      [localNodeBlockNumber, mainNodeBlockNumber],
    );
    return record;
  }

  async latest(): Promise<IBitcoinActivityRecord | null> {
    const records = await this.db.sql.select<IBitcoinActivityRecord[]>(
      'SELECT * FROM bitcoin_activities ORDER BY inserted_at DESC LIMIT 1',
      [],
    );
    return records[0] || null;
  }

  async fetchLastFiveRecords(): Promise<IBitcoinActivityRecord[]> {
    return await this.db.sql.select<IBitcoinActivityRecord[]>(
      'SELECT * FROM bitcoin_activities ORDER BY inserted_at DESC LIMIT 5',
      [],
    );
  }
}
