import { BaseTable } from './BaseTable';

interface IBotActivityRecord {
  tag: string;
  insertedAt: string;
}

export class BotActivitiesTable extends BaseTable {
  async insert(tag: string, insertedAt: string): Promise<IBotActivityRecord> {
    const [record] = await this.db.sql.select<IBotActivityRecord[]>(
      'INSERT INTO bot_activities (tag, inserted_at) VALUES (?1, ?2) RETURNING *',
      [tag, insertedAt],
    );
    return record;
  }

  async fetchLastFiveRecords(): Promise<IBotActivityRecord[]> {
    return await this.db.sql.select<IBotActivityRecord[]>(
      'SELECT * FROM bot_activities ORDER BY inserted_at DESC LIMIT 5',
      [],
    );
  }
}
