import { IFrameRecord } from '../../interfaces/db/IFrameRecord';
import { BaseTable, IFieldTypes } from './BaseTable';
import { convertSqliteFields, toSqlParams } from '../Utils';

export class FramesTable extends BaseTable {
  private fields: IFieldTypes = {
    booleanFields: ['isProcessed'],
    bigintJsonFields: ['microgonToUsd', 'microgonToBtc', 'microgonToArgonot'],
  };

  async insertOrUpdate(
    id: number,
    firstTick: number,
    lastTick: number,
    firstBlockNumber: number,
    lastBlockNumber: number,
    microgonToUsd: bigint[],
    microgonToBtc: bigint[],
    microgonToArgonot: bigint[],
    progress: number,
    isProcessed: boolean,
  ): Promise<void> {
    await this.db.sql.execute(
      'INSERT OR REPLACE INTO frames (id, firstTick, lastTick, firstBlockNumber, lastBlockNumber, microgonToUsd, microgonToBtc, microgonToArgonot, progress, isProcessed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      toSqlParams([
        id,
        firstTick,
        lastTick,
        firstBlockNumber,
        lastBlockNumber,
        microgonToUsd,
        microgonToBtc,
        microgonToArgonot,
        progress,
        isProcessed,
      ]),
    );
  }

  async update(
    id: number,
    firstTick: number,
    lastTick: number,
    firstBlockNumber: number,
    lastBlockNumber: number,
    microgonToUsd: bigint[],
    microgonToBtc: bigint[],
    microgonToArgonot: bigint[],
    progress: number,
    isProcessed: boolean,
  ): Promise<void> {
    await this.db.sql.execute(
      'UPDATE frames SET firstTick = ?, lastTick = ?, firstBlockNumber = ?, lastBlockNumber = ?, microgonToUsd = ?, microgonToBtc = ?, microgonToArgonot = ?, progress = ?, isProcessed = ? WHERE id = ?',
      toSqlParams([
        firstTick,
        lastTick,
        firstBlockNumber,
        lastBlockNumber,
        microgonToUsd,
        microgonToBtc,
        microgonToArgonot,
        progress,
        isProcessed,
        id,
      ]),
    );
  }

  async fetchById(id: number): Promise<IFrameRecord> {
    const [rawRecord] = await this.db.sql.select<[any]>('SELECT * FROM frames WHERE id = ?', [id]);
    if (!rawRecord) throw new Error(`Frame ${id} not found`);

    return convertSqliteFields(rawRecord, this.fields) as IFrameRecord;
  }

  async fetchProcessedCount(): Promise<number> {
    const [result] = await this.db.sql.select<[{ count: number }]>(
      'SELECT COUNT(*) as count FROM frames WHERE isProcessed = 1',
    );
    return result.count;
  }

  async latestId(): Promise<number> {
    const [rawRecord] = await this.db.sql.select<[{ maxId: number }]>(
      'SELECT COALESCE(MAX(id), 0) as maxId FROM frames',
    );
    return rawRecord.maxId;
  }
}
