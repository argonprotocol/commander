import { ICohortFrameStats, ICohortFrameRecord } from '../../interfaces/db/ICohortFrameRecord';
import { BaseTable } from './BaseTable';
import camelcaseKeys from 'camelcase-keys';
import { fromSqliteBigInt, toSqliteBigInt, convertSqliteBigInts } from '../Utils';

export class CohortFramesTable extends BaseTable {
  private bigIntFields: string[] = ['micronots_mined', 'microgons_mined', 'microgons_minted'];

  async insertOrUpdate(
    frameId: number,
    cohortId: number,
    blocksMined: number,
    micronotsMined: bigint,
    microgonsMined: bigint,
    microgonsMinted: bigint,
  ): Promise<void> {
    await this.db.sql.execute(
      'INSERT OR REPLACE INTO cohort_frames (frame_id, cohort_id, blocks_mined, micronots_mined, microgons_mined, microgons_minted) VALUES (?, ?, ?, ?, ?, ?)',
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
    const records = await this.db.sql.select<any[]>('SELECT * FROM cohort_frames WHERE frame_id >= ?', [
      currentFrameId - 10,
    ]);
    return camelcaseKeys(convertSqliteBigInts(records, this.bigIntFields)) as ICohortFrameRecord[];
  }

  public async fetchGlobalStats(): Promise<ICohortFrameStats> {
    const [rawResults] = await this.db.sql.select<[any]>(
      `SELECT 
        COALESCE(sum(blocks_mined), 0) as total_blocks_mined,
        COALESCE(sum(micronots_mined), 0) as total_micronots_mined,
        COALESCE(sum(microgons_mined), 0) as total_microgons_mined,
        COALESCE(sum(microgons_minted), 0) as total_microgons_minted
      FROM cohort_frames`,
    );

    const results = camelcaseKeys(rawResults);
    return {
      totalBlocksMined: results.totalBlocksMined,
      totalMicronotsMined: fromSqliteBigInt(results.totalMicronotsMined),
      totalMicrogonsMined: fromSqliteBigInt(results.totalMicrogonsMined),
      totalMicrogonsMinted: fromSqliteBigInt(results.totalMicrogonsMinted),
    };
  }

  public async fetchCohortStats(cohortId: number): Promise<ICohortFrameStats> {
    const [rawResults] = await this.db.sql.select<[any]>(
      `SELECT 
        COALESCE(sum(blocks_mined), 0) as total_blocks_mined,
        COALESCE(sum(micronots_mined), 0) as total_micronots_mined,
        COALESCE(sum(microgons_mined), 0) as total_microgons_mined,
        COALESCE(sum(microgons_minted), 0) as total_microgons_minted
      FROM cohort_frames WHERE cohort_id = ?`,
      [cohortId],
    );

    const results = camelcaseKeys(rawResults);
    return {
      totalBlocksMined: results.totalBlocksMined,
      totalMicronotsMined: fromSqliteBigInt(results.totalMicronotsMined),
      totalMicrogonsMined: fromSqliteBigInt(results.totalMicrogonsMined),
      totalMicrogonsMinted: fromSqliteBigInt(results.totalMicrogonsMinted),
    };
  }
}
