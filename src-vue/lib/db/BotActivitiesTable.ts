import { BaseTable, IFieldTypes } from './BaseTable';
import { IBotActivityRecord } from '../../interfaces/db/IBotActivityRecord';
import { convertFromSqliteFields, toSqlParams } from '../Utils';

export class BotActivitiesTable extends BaseTable {
  private fieldTypes: IFieldTypes = {
    json: ['data'],
  };

  async insertOrUpdate(
    id: number,
    tick: number,
    blockNumber: number | undefined,
    frameId: number | undefined,
    type: string,
    data: any,
  ): Promise<void> {
    await this.db.execute(
      `INSERT INTO BotActivities (
          id, frameId, tick, blockNumber, type, data
        ) VALUES (
          ?, ?, ?, ?, ?, ?
        ) ON CONFLICT(id) DO UPDATE SET 
          frameId = excluded.frameId, 
          tick = excluded.tick, 
          blockNumber = excluded.blockNumber, 
          type = excluded.type, 
          data = excluded.data
      `,
      toSqlParams([id, frameId, tick, blockNumber, type, data]),
    );
  }

  async fetchRecentRecords(limit: number): Promise<IBotActivityRecord[]> {
    const rawRecords = await this.db.select<IBotActivityRecord[]>(
      'SELECT * FROM BotActivities ORDER BY id DESC LIMIT ?',
      [limit],
    );
    return convertFromSqliteFields(rawRecords, this.fieldTypes);
  }
}
