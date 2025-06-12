import { IFrameRecord } from '../../interfaces/db/IFrameRecord';
import { BaseTable } from './BaseTable';

export class FramesTable extends BaseTable {
  async insertOrUpdate(
    id: number,
    tickStart: number,
    tickEnd: number,
    progress: number,
    isProcessed: boolean,
  ): Promise<IFrameRecord> {
    const [result] = await this.db.sql.select<[IFrameRecord]>(
      'INSERT OR REPLACE INTO frames (id, tick_start, tick_end, progress, is_processed) VALUES (?, ?, ?, ?, ?) RETURNING *',
      [id, tickStart, tickEnd, progress, isProcessed],
    );
    return result;
  }

  async update(
    id: number,
    tickStart: number,
    tickEnd: number,
    progress: number,
    isProcessed: boolean,
  ): Promise<void> {
    await this.db.sql.execute(
      'UPDATE frames SET tick_start = ?, tick_end = ?, progress = ?, is_processed = ? WHERE id = ?',
      [tickStart, tickEnd, progress, isProcessed, id],
    );
  }

  async fetchById(id: number): Promise<IFrameRecord> {
    const [result] = await this.db.sql.select<[IFrameRecord]>('SELECT * FROM frames WHERE id = ?', [
      id,
    ]);
    return result;
  }

  async fetchRecordCount(): Promise<number> {
    const [result] = await this.db.sql.select<[{ count: number }]>(
      'SELECT COUNT(*) as count FROM frames',
    );
    return result.count;
  }

  async latestId(): Promise<number> {
    const [result] = await this.db.sql.select<[{ max_id: number }]>(
      'SELECT COALESCE(MAX(id), 0) as max_id FROM frames',
    );
    return result.max_id;
  }
}
