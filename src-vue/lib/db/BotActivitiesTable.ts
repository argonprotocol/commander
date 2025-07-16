import { BaseTable } from './BaseTable';
import { IBotActivityRecord } from '../../interfaces/db/IBotActivityRecord';
import { convertSqliteBigInts } from '../Utils';

export class BotActivitiesTable extends BaseTable {
  private bigIntFields: string[] = ['bidAmount'];

  async insert(tag: string, insertedAt: string): Promise<void> {
    await this.db.sql.execute('INSERT INTO bot_activities (tag, insertedAt) VALUES (?, ?)', [tag, insertedAt]);
  }

  async fetchLastFiveRecords(): Promise<IBotActivityRecord[]> {
    const rawRecords = await this.db.sql.select<IBotActivityRecord[]>(
      'SELECT * FROM bot_activities ORDER BY insertedAt DESC LIMIT 5',
      [],
    );
    return convertSqliteBigInts(rawRecords, this.bigIntFields);
  }
}
