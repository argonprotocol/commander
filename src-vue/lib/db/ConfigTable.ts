import { IConfig, IConfigStringified } from '../../interfaces/IConfig';
import { IConfigRecord } from '../../interfaces/db/IConfigRecord';
import { BaseTable } from './BaseTable';

export class ConfigTable extends BaseTable {
  public async fetchAllAsObject(): Promise<Partial<IConfig>> {
    const data: any = {};
    const rows = await this.db.select<IConfigRecord[]>('SELECT key, value FROM Config', []);

    for (const row of rows) {
      data[row.key] = row.value;
    }

    return data;
  }

  public async insertOrReplace(obj: Partial<IConfigStringified>) {
    const db = await this.db;
    const entries = Object.entries(obj);
    if (entries.length === 0) return;

    const placeholders = entries.map(() => '(?, ?)').join(', ');
    const values = entries.flatMap(([key, value]) => [key, value]);

    await db.sql.execute(`INSERT OR REPLACE INTO Config (key, value) VALUES ${placeholders}`, values);
  }
}
