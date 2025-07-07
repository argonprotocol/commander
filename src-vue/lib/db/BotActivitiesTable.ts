import { BaseTable } from './BaseTable';
import camelcaseKeys from 'camelcase-keys';
import { IBotActivityRecord } from '../../interfaces/db/IBotActivityRecord';
import { convertSqliteBigInts } from '../Utils';

export class BotActivitiesTable extends BaseTable {
  private bigIntFields: string[] = ['bid_amount'];

  async insert(tag: string, insertedAt: string): Promise<void> {
    await this.db.sql.execute('INSERT INTO bot_activities (tag, inserted_at) VALUES (?, ?)', [tag, insertedAt]);
  }

  async fetchLastFiveRecords(): Promise<IBotActivityRecord[]> {
    const rawRecords = await this.db.sql.select<any[]>(
      'SELECT * FROM bot_activities ORDER BY inserted_at DESC LIMIT 5',
      [],
    );
    return camelcaseKeys(convertSqliteBigInts(rawRecords, this.bigIntFields)) as IBotActivityRecord[];
  }
}
