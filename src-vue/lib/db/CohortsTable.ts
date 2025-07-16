import { ICohortRecord } from '../../interfaces/db/ICohortRecord';
import { BaseTable } from './BaseTable';
import { convertSqliteBigInts, fromSqliteBigInt, toSqlParams } from '../Utils';

export class CohortsTable extends BaseTable {
  private bigIntFields: string[] = [
    'transactionFees',
    'microgonsBid',
    'micronotsStaked',
    'microgonsToBeMined',
    'micronotsToBeMined',
  ];

  public async fetchLatestActiveId(): Promise<number | null> {
    const result = await this.db.sql.select<{ id: number }[]>(
      'SELECT id FROM cohorts WHERE seatsWon > 0 ORDER BY id DESC LIMIT 1',
    );
    return result.length > 0 ? result[0].id : null;
  }

  public async fetchById(
    id: number,
  ): Promise<(ICohortRecord & { firstTick: number; lastTick: number; lastBlockNumber: number }) | null> {
    const rawRecords = await this.db.sql.select<any[]>(
      `SELECT cohorts.*, frames.firstTick as firstTick, frames.lastBlockNumber as lastBlockNumber FROM cohorts
      LEFT JOIN frames ON cohorts.id = frames.id
      WHERE seatsWon > 0
      AND cohorts.id = ?
      ORDER BY cohorts.id
      DESC LIMIT 1`,
      [id],
    );

    if (rawRecords.length === 0) {
      return null;
    }

    const record = convertSqliteBigInts(rawRecords[0], this.bigIntFields);
    const ticksPerDay = 1_440;
    const lastTick = record.firstTick + ticksPerDay * 10;

    return {
      ...record,
      lastTick,
    };
  }

  public async fetchGlobalStats(currentFrameId: number): Promise<{
    totalActiveCohorts: number;
    totalActiveSeats: number;
    totalTransactionFees: bigint;
    totalMicrogonsBid: bigint;
  }> {
    try {
      const [rawTotalStats] = await this.db.sql.select<[any]>(
        `SELECT 
        COALESCE(sum(transactionFees), 0) as totalTransactionFees, 
        COALESCE(sum(microgonsBid), 0) as totalMicrogonsBid
      FROM cohorts`,
      );

      const oldestActiveFrameId = Math.max(1, currentFrameId - 10);
      const [rawActiveStats] = await this.db.sql.select<[any]>(
        `SELECT 
        COALESCE(count(id), 0) as activeCohorts,
        COALESCE(sum(seatsWon), 0) as activeSeats
      FROM cohorts WHERE id >= ?`,
        [oldestActiveFrameId],
      );

      const totalStats = rawTotalStats;
      const activeStats = rawActiveStats;

      return {
        totalActiveCohorts: activeStats.activeCohorts,
        totalActiveSeats: activeStats.activeSeats,
        totalTransactionFees: fromSqliteBigInt(totalStats.totalTransactionFees),
        totalMicrogonsBid: fromSqliteBigInt(totalStats.totalMicrogonsBid),
      };
    } catch (e) {
      console.error('Error fetching global stats', e);
      throw e;
    }
  }

  async fetchActiveCohorts(currentFrameId: number): Promise<ICohortRecord[]> {
    const records = await this.db.sql.select<any[]>('SELECT * FROM cohorts WHERE seatsWon > 0 AND id >= ?', [
      currentFrameId - 10,
    ]);
    return convertSqliteBigInts(records, this.bigIntFields) as ICohortRecord[];
  }

  async insertOrUpdate(
    id: number,
    progress: number,
    transactionFees: bigint,
    micronotsStaked: bigint,
    microgonsBid: bigint,
    seatsWon: number,
    microgonsToBeMined: bigint,
    micronotsToBeMined: bigint,
  ): Promise<void> {
    await this.db.sql.execute(
      `INSERT OR REPLACE INTO cohorts (
        id, 
        progress, 
        transactionFees, 
        micronotsStaked, 
        microgonsBid, 
        seatsWon, 
        microgonsToBeMined, 
        micronotsToBeMined) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      toSqlParams([
        id,
        progress,
        transactionFees,
        micronotsStaked,
        microgonsBid,
        seatsWon,
        microgonsToBeMined,
        micronotsToBeMined,
      ]),
    );
  }
}
