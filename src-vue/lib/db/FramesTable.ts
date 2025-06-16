import { IFrameRecord } from '../../interfaces/db/IFrameRecord';
import { BaseTable } from './BaseTable';
import camelcaseKeys from 'camelcase-keys';
import { convertSqliteBooleans, toSqliteBoolean } from '../Utils';

export class FramesTable extends BaseTable {
  private booleanFields: string[] = ['is_processed'];

  async insertOrUpdate(
    id: number,
    firstTick: number,
    lastTick: number,
    firstBlockNumber: number,
    lastBlockNumber: number,
    progress: number,
    isProcessed: boolean,
  ): Promise<void> {
    await this.db.sql.execute(
      'INSERT OR REPLACE INTO frames (id, first_tick, last_tick, first_block_number, last_block_number, progress, is_processed) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        firstTick,
        lastTick,
        firstBlockNumber,
        lastBlockNumber,
        progress,
        toSqliteBoolean(isProcessed),
      ],
    );
  }

  async update(
    id: number,
    firstTick: number,
    lastTick: number,
    firstBlockNumber: number,
    lastBlockNumber: number,
    progress: number,
    isProcessed: boolean,
  ): Promise<void> {
    await this.db.sql.execute(
      'UPDATE frames SET first_tick = ?, last_tick = ?, first_block_number = ?, last_block_number = ?, progress = ?, is_processed = ? WHERE id = ?',
      [
        firstTick,
        lastTick,
        firstBlockNumber,
        lastBlockNumber,
        progress,
        toSqliteBoolean(isProcessed),
        id,
      ],
    );
  }

  async fetchById(id: number): Promise<IFrameRecord> {
    const [rawRecord] = await this.db.sql.select<[any]>('SELECT * FROM frames WHERE id = ?', [id]);

    if (!rawRecord) throw new Error(`Frame ${id} not found`);

    return camelcaseKeys(convertSqliteBooleans(rawRecord, this.booleanFields)) as IFrameRecord;
  }

  async fetchProcessedCount(): Promise<number> {
    const [result] = await this.db.sql.select<[{ count: number }]>(
      'SELECT COUNT(*) as count FROM frames WHERE is_processed = 1',
    );
    return result.count;
  }

  async latestId(): Promise<number> {
    const [rawRecord] = await this.db.sql.select<[{ max_id: number }]>(
      'SELECT COALESCE(MAX(id), 0) as max_id FROM frames',
    );
    return rawRecord.max_id;
  }
}
