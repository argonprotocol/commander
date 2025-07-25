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
    const result = await this.db.select<{ id: number }[]>(
      'SELECT id FROM Cohorts WHERE seatsWon > 0 ORDER BY id DESC LIMIT 1',
    );
    return result.length > 0 ? result[0].id : null;
  }

  public async fetchById(
    id: number,
  ): Promise<(ICohortRecord & { firstTick: number; lastTick: number; lastBlockNumber: number }) | null> {
    const rawRecords = await this.db.select<any[]>(
      `SELECT Cohorts.*, Frames.firstTick as firstTick, Frames.lastBlockNumber as lastBlockNumber FROM Cohorts
      LEFT JOIN Frames ON Cohorts.id = Frames.id
      WHERE Cohorts.id = ?
      ORDER BY Cohorts.id DESC LIMIT 1`,
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
      const [rawTotalStats] = await this.db.select<[any]>(
        `SELECT 
        COALESCE(sum(transactionFees), 0) as totalTransactionFees, 
        COALESCE(sum(microgonsBid), 0) as totalMicrogonsBid
      FROM Cohorts`,
      );

      const oldestActiveFrameId = Math.max(1, currentFrameId - 10);
      const [rawActiveStats] = await this.db.select<[any]>(
        `SELECT 
        COALESCE(count(id), 0) as activeCohorts,
        COALESCE(sum(seatsWon), 0) as activeSeats
      FROM Cohorts WHERE id >= ? AND seatsWon > 0`,
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
    const records = await this.db.select<any[]>('SELECT * FROM Cohorts WHERE seatsWon > 0 AND id >= ?', [
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
    await this.db.execute(
      `INSERT OR REPLACE INTO Cohorts (
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

  async fetchCount(): Promise<number> {
    const [result] = await this.db.select<[{ count: number }]>('SELECT COUNT(*) as count FROM Cohorts');
    return result.count;
  }
}
