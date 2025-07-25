import { IFrameRecord } from '../../interfaces/db/IFrameRecord';
import { BaseTable, IFieldTypes } from './BaseTable';
import { convertFromSqliteFields, toSqlParams } from '../Utils';

export class FramesTable extends BaseTable {
  private fieldTypes: IFieldTypes = {
    boolean: ['isProcessed'],
    bigintJson: ['microgonToUsd', 'microgonToBtc', 'microgonToArgonot'],
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
    await this.db.execute(
      'INSERT OR REPLACE INTO Frames (id, firstTick, lastTick, firstBlockNumber, lastBlockNumber, microgonToUsd, microgonToBtc, microgonToArgonot, progress, isProcessed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
    await this.db.execute(
      'UPDATE Frames SET firstTick = ?, lastTick = ?, firstBlockNumber = ?, lastBlockNumber = ?, microgonToUsd = ?, microgonToBtc = ?, microgonToArgonot = ?, progress = ?, isProcessed = ? WHERE id = ?',
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
    const [rawRecord] = await this.db.select<[any]>('SELECT * FROM Frames WHERE id = ?', [id]);
    if (!rawRecord) throw new Error(`Frame ${id} not found`);

    return convertFromSqliteFields(rawRecord, this.fieldTypes) as IFrameRecord;
  }

  async fetchProcessedCount(): Promise<number> {
    const [result] = await this.db.select<[{ count: number }]>(
      'SELECT COUNT(*) as count FROM Frames WHERE isProcessed = 1',
    );
    return result.count;
  }

  async latestId(): Promise<number> {
    const [rawRecord] = await this.db.select<[{ maxId: number }]>('SELECT COALESCE(MAX(id), 0) as maxId FROM Frames');
    return rawRecord.maxId;
  }
}
