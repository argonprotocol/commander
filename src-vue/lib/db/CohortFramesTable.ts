import { ICohortFrameStats, ICohortFrameRecord } from '../../interfaces/db/ICohortFrames';
import { BaseTable } from './BaseTable';

export class CohortFramesTable extends BaseTable {
  async insertOrUpdate(
    frameId: number,
    cohortId: number,
    blocksMined: number,
    argonotsMined: number,
    argonsMined: number,
    argonsMinted: number,
  ): Promise<ICohortFrameRecord> {
    const [result] = await this.db.sql.select<[ICohortFrameRecord]>(
      'INSERT OR REPLACE INTO cohort_frames (frame_id, cohort_id, blocks_mined, argonots_mined, argons_mined, argons_minted) VALUES (?, ?, ?, ?, ?, ?) RETURNING *',
      [frameId, cohortId, blocksMined, argonotsMined, argonsMined, argonsMinted],
    );
    return result;
  }

  public async fetchGlobalStats(): Promise<ICohortFrameStats> {
    const [stats] = await this.db.sql.select<ICohortFrameStats[]>(
      `SELECT 
        COALESCE(sum(blocks_mined), 0) as total_blocks_mined,
        COALESCE(sum(argonots_mined), 0) as total_argonots_mined,
        COALESCE(sum(argons_mined), 0) as total_argons_mined,
        COALESCE(sum(argons_minted), 0) as total_argons_minted
      FROM cohort_frames`,
    );

    return stats;
  }

  public async fetchCohortStats(cohortId: number): Promise<ICohortFrameStats> {
    const [stats] = await this.db.sql.select<ICohortFrameStats[]>(
      `SELECT 
        COALESCE(sum(blocks_mined), 0) as total_blocks_mined,
        COALESCE(sum(argonots_mined), 0) as total_argonots_mined,
        COALESCE(sum(argons_mined), 0) as total_argons_mined,
        COALESCE(sum(argons_minted), 0) as total_argons_minted
      FROM cohort_frames WHERE cohort_id = ?`,
      [cohortId],
    );

    return stats;
  }
}
