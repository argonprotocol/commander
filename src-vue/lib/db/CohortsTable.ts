import { ICohortRecord } from '../../interfaces/db/ICohortRecord';
import { BaseTable } from './BaseTable';
import { convertSqliteBigInts, fromSqliteBigInt, toSqlParams } from '../Utils';
import BigNumber from 'bignumber.js';
import { bigNumberToBigInt } from '@argonprotocol/commander-calculator';

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
    totalSeats: number;
    framesMined: number;
    framesRemaining: number;
    framedCost: bigint;
    totalTransactionFees: bigint;
    totalMicrogonsBid: bigint;
  }> {
    try {
      const [rawTotalStats] = await this.db.select<[any]>(
        `SELECT 
        COALESCE(sum(transactionFees), 0) as totalTransactionFees, 
        COALESCE(sum(microgonsBid), 0) as totalMicrogonsBid,
        COALESCE(sum((microgonsBid + transactionFees) * seatsWon * (progress / 100)), 0) as framedCost
      FROM Cohorts`,
      );

      // const oldestActiveFrameId = Math.max(1, currentFrameId - 10);
      const [rawActiveStats] = await this.db.select<[any]>(
        `SELECT 
        count(*) as cohortCount,
        COALESCE(sum(progress * seatsWon), 0.0) as totalFlooredProgress,
        COALESCE(sum(seatsWon), 0) as totalSeats
      FROM Cohorts WHERE seatsWon > 0`,
        [],
      );

      const totalStats = rawTotalStats;
      const activeStats = rawActiveStats;

      const framesExpectedBn = BigNumber(activeStats.cohortCount).multipliedBy(10).multipliedBy(activeStats.totalSeats);
      const framesMined = BigNumber(activeStats.totalFlooredProgress).dividedBy(10).toNumber();
      const framesRemaining = framesExpectedBn.minus(framesMined).toNumber();

      return {
        totalSeats: activeStats.totalSeats,
        framesMined,
        framesRemaining,
        framedCost: fromSqliteBigInt(totalStats.framedCost),
        totalTransactionFees: fromSqliteBigInt(totalStats.totalTransactionFees),
        totalMicrogonsBid: fromSqliteBigInt(totalStats.totalMicrogonsBid),
      };
    } catch (e) {
      console.error('Error fetching global stats', e);
      throw e;
    }
  }

  async fetchActiveSeatData(
    frameId: number,
    frameProgress: number,
  ): Promise<{ activeSeatCount: number; totalSeatCost: bigint }> {
    const [rawActiveStats] = await this.db.select<[any]>(
      `SELECT 
        COALESCE(sum(seatsWon), 0) as seatCount,
        COALESCE(sum(microgonsBid * seatsWon), 0) as totalSeatCost
      FROM Cohorts WHERE id <= ? AND id >= ?`,
      [frameId, frameId - 9],
    );

    const frameProgressBn = BigNumber(frameProgress).dividedBy(100);
    const seatCostPerDayBn = BigNumber(fromSqliteBigInt(rawActiveStats.totalSeatCost)).dividedBy(10);
    const totalSeatCostBn = BigNumber(seatCostPerDayBn).multipliedBy(frameProgressBn);

    return {
      activeSeatCount: rawActiveStats.seatCount,
      totalSeatCost: bigNumberToBigInt(totalSeatCostBn),
    };
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
      `INSERT INTO Cohorts (
          id, 
          progress, 
          transactionFees, 
          micronotsStaked, 
          microgonsBid, 
          seatsWon, 
          microgonsToBeMined, 
          micronotsToBeMined
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?
        ) ON CONFLICT(id) DO UPDATE SET 
          progress = excluded.progress, 
          transactionFees = excluded.transactionFees, 
          micronotsStaked = excluded.micronotsStaked, 
          microgonsBid = excluded.microgonsBid, 
          seatsWon = excluded.seatsWon, 
          microgonsToBeMined = excluded.microgonsToBeMined, 
          micronotsToBeMined = excluded.micronotsToBeMined
      `,
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
