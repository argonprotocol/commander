import { BaseTable } from './BaseTable';
import camelcaseKeys from 'camelcase-keys';

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
    const [rawRecord] = await this.db.sql.select<any[]>(
      'INSERT INTO bitcoin_activities (local_node_block_number, main_node_block_number) VALUES (?1, ?2) RETURNING *',
      [localNodeBlockNumber, mainNodeBlockNumber],
    );
    return camelcaseKeys(rawRecord) as IBitcoinActivityRecord;
  }

  async latest(): Promise<IBitcoinActivityRecord | null> {
    const rawRecords = await this.db.sql.select<any[]>(
      'SELECT * FROM bitcoin_activities ORDER BY inserted_at DESC LIMIT 1',
      [],
    );
    return rawRecords[0] ? (camelcaseKeys(rawRecords[0]) as IBitcoinActivityRecord) : null;
  }

  async fetchLastFiveRecords(): Promise<IBitcoinActivityRecord[]> {
    const rawRecords = await this.db.sql.select<any[]>(
      'SELECT * FROM bitcoin_activities ORDER BY inserted_at DESC LIMIT 5',
      [],
    );
    return camelcaseKeys(rawRecords) as IBitcoinActivityRecord[];
  }
}
