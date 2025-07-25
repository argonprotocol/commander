import { ICohortFrameRecord, ICohortFrameStats } from '../../interfaces/db/ICohortFrameRecord';
import { BaseTable } from './BaseTable';
import { convertSqliteBigInts, fromSqliteBigInt, toSqliteBigInt } from '../Utils';

export class CohortFramesTable extends BaseTable {
  private bigIntFields: string[] = ['micronotsMined', 'microgonsMined', 'microgonsMinted'];

  async insertOrUpdate(
    frameId: number,
    cohortId: number,
    blocksMined: number,
    micronotsMined: bigint,
    microgonsMined: bigint,
    microgonsMinted: bigint,
  ): Promise<void> {
    await this.db.execute(
      'INSERT OR REPLACE INTO CohortFrames (frameId, cohortId, blocksMined, micronotsMined, microgonsMined, microgonsMinted) VALUES (?, ?, ?, ?, ?, ?)',
      [
        frameId,
        cohortId,
        blocksMined,
        toSqliteBigInt(micronotsMined),
        toSqliteBigInt(microgonsMined),
        toSqliteBigInt(microgonsMinted),
      ],
    );
  }

  async fetchActiveCohortFrames(currentFrameId: number): Promise<ICohortFrameRecord[]> {
    const records = await this.db.select<ICohortFrameRecord[]>('SELECT * FROM CohortFrames WHERE frameId >= ?', [
      currentFrameId - 10,
    ]);
    return convertSqliteBigInts(records, this.bigIntFields);
  }

  public async fetchGlobalStats(): Promise<ICohortFrameStats> {
    const [rawResults] = await this.db.select<[any]>(
      `SELECT 
        COALESCE(sum(blocksMined), 0) as totalBlocksMined,
        COALESCE(sum(micronotsMined), 0) as totalMicronotsMined,
        COALESCE(sum(microgonsMined), 0) as totalMicrogonsMined,
        COALESCE(sum(microgonsMinted), 0) as totalMicrogonsMinted
      FROM CohortFrames`,
    );

    const results = rawResults;
    return {
      totalBlocksMined: results.totalBlocksMined,
      totalMicronotsMined: fromSqliteBigInt(results.totalMicronotsMined),
      totalMicrogonsMined: fromSqliteBigInt(results.totalMicrogonsMined),
      totalMicrogonsMinted: fromSqliteBigInt(results.totalMicrogonsMinted),
    };
  }

  public async fetchCohortStats(cohortId: number): Promise<ICohortFrameStats> {
    const [rawResults] = await this.db.select<[any]>(
      `SELECT 
        COALESCE(sum(blocksMined), 0) as totalBlocksMined,
        COALESCE(sum(micronotsMined), 0) as totalMicronotsMined,
        COALESCE(sum(microgonsMined), 0) as totalMicrogonsMined,
        COALESCE(sum(microgonsMinted), 0) as totalMicrogonsMinted
      FROM CohortFrames WHERE cohortId = ?`,
      [cohortId],
    );

    const results = rawResults;
    return {
      totalBlocksMined: results.totalBlocksMined,
      totalMicronotsMined: fromSqliteBigInt(results.totalMicronotsMined),
      totalMicrogonsMined: fromSqliteBigInt(results.totalMicrogonsMined),
      totalMicrogonsMinted: fromSqliteBigInt(results.totalMicrogonsMinted),
    };
  }
}
