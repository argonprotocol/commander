import { ICohortFrameStats, ICohortFrameRecord } from '../../interfaces/db/ICohortFrames';
import { BaseTable } from './BaseTable';
import camelcaseKeys from 'camelcase-keys';

export class CohortFramesTable extends BaseTable {
  async insertOrUpdate(
    frameId: number,
    cohortId: number,
    blocksMined: number,
    argonotsMined: number,
    argonsMined: number,
    argonsMinted: number,
  ): Promise<void> {
    await this.db.sql.execute(
      'INSERT OR REPLACE INTO cohort_frames (frame_id, cohort_id, blocks_mined, argonots_mined, argons_mined, argons_minted) VALUES (?, ?, ?, ?, ?, ?)',
      [frameId, cohortId, blocksMined, argonotsMined, argonsMined, argonsMinted],
    );
  }

  public async fetchGlobalStats(): Promise<ICohortFrameStats> {
    const [rawResults] = await this.db.sql.select<[any]>(
      `SELECT 
        COALESCE(sum(blocks_mined), 0) as total_blocks_mined,
        COALESCE(sum(argonots_mined), 0) as total_argonots_mined,
        COALESCE(sum(argons_mined), 0) as total_argons_mined,
        COALESCE(sum(argons_minted), 0) as total_argons_minted
      FROM cohort_frames`,
    );

    return camelcaseKeys(rawResults) as ICohortFrameStats;
  }

  public async fetchCohortStats(cohortId: number): Promise<ICohortFrameStats> {
    const [rawResults] = await this.db.sql.select<[any]>(
      `SELECT 
        COALESCE(sum(blocks_mined), 0) as total_blocks_mined,
        COALESCE(sum(argonots_mined), 0) as total_argonots_mined,
        COALESCE(sum(argons_mined), 0) as total_argons_mined,
        COALESCE(sum(argons_minted), 0) as total_argons_minted
      FROM cohort_frames WHERE cohort_id = ?`,
      [cohortId],
    );

    return camelcaseKeys(rawResults) as ICohortFrameStats;
  }
}
