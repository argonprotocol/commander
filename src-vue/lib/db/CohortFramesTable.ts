import { ICohortFrameRecord, ICohortFrameStats } from '../../interfaces/db/ICohortFrameRecord';
import { BaseTable } from './BaseTable';
import { convertSqliteBigInts, fromSqliteBigInt, toSqliteBigInt } from '../Utils';

export class CohortFramesTable extends BaseTable {
  private bigIntFields: string[] = ['micronotsMined', 'microgonsMined', 'microgonsMinted', 'microgonFeesMined'];

  async insertOrUpdate(args: {
    frameId: number;
    cohortActivationFrameId: number;
    blocksMined: number;
    micronotsMined: bigint;
    microgonsMined: bigint;
    microgonsMinted: bigint;
    microgonFeesMined: bigint;
  }): Promise<void> {
    const {
      frameId,
      cohortActivationFrameId,
      blocksMined,
      micronotsMined,
      microgonsMined,
      microgonsMinted,
      microgonFeesMined,
    } = args;
    await this.db.execute(
      `INSERT INTO CohortFrames (
          frameId, cohortId, blocksMined, micronotsMined, microgonsMined, microgonsMinted
        ) VALUES (
          ?, ?, ?, ?, ?, ?
        ) ON CONFLICT(frameId, cohortId) DO UPDATE SET 
          blocksMined = excluded.blocksMined, 
          micronotsMined = excluded.micronotsMined, 
          microgonsMined = excluded.microgonsMined, 
          microgonsMinted = excluded.microgonsMinted,
          microgonFeesMined = excluded.microgonFeesMined
      `,
      [
        frameId,
        cohortActivationFrameId,
        blocksMined,
        toSqliteBigInt(micronotsMined),
        toSqliteBigInt(microgonsMined),
        toSqliteBigInt(microgonsMinted),
        toSqliteBigInt(microgonFeesMined),
      ],
    );
  }

  async fetchActiveCohortFrames(currentFrameId: number): Promise<ICohortFrameRecord[]> {
    const records = await this.db.select<ICohortFrameRecord[]>('SELECT * FROM CohortFrames WHERE frameId >= ?', [
      currentFrameId - 10,
    ]);
    return convertSqliteBigInts(records, this.bigIntFields);
  }

  public async fetchGlobalStats(): Promise<Omit<ICohortFrameStats, 'totalBlocksMined'>> {
    const [rawResults] = await this.db.select<[any]>(
      `SELECT 
        COALESCE(sum(micronotsMined), 0) as totalMicronotsMined,
        COALESCE(sum(microgonsMined), 0) as totalMicrogonsMined,
        COALESCE(sum(microgonsMinted), 0) as totalMicrogonsMinted
      FROM CohortFrames`,
    );

    const results = rawResults;
    return {
      totalMicronotsMined: fromSqliteBigInt(results.totalMicronotsMined),
      totalMicrogonsMined: fromSqliteBigInt(results.totalMicrogonsMined),
      totalMicrogonsMinted: fromSqliteBigInt(results.totalMicrogonsMinted),
    };
  }
}
