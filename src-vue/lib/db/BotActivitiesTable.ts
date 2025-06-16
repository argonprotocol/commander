import { BaseTable } from './BaseTable';
import camelcaseKeys from 'camelcase-keys';

interface IBotActivityRecord {
  tag: string;
  insertedAt: string;
}

export class BotActivitiesTable extends BaseTable {
  async insert(tag: string, insertedAt: string): Promise<IBotActivityRecord> {
    const [rawRecord] = await this.db.sql.select<[any]>(
      'INSERT INTO bot_activities (tag, inserted_at) VALUES (?1, ?2) RETURNING *',
      [tag, insertedAt],
    );
    return camelcaseKeys(rawRecord) as IBotActivityRecord;
  }

  async fetchLastFiveRecords(): Promise<IBotActivityRecord[]> {
    const rawRecords = await this.db.sql.select<any[]>(
      'SELECT * FROM bot_activities ORDER BY inserted_at DESC LIMIT 5',
      [],
    );
    return camelcaseKeys(rawRecords) as IBotActivityRecord[];
  }
}
