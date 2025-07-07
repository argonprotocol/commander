import { ICohortRecord } from '../../interfaces/db/ICohortRecord';
import { BaseTable } from './BaseTable';
import camelcaseKeys from 'camelcase-keys';
import { convertSqliteBigInts, fromSqliteBigInt, toSqliteBigInt } from '../Utils';

export class CohortsTable extends BaseTable {
  private bigIntFields: string[] = [
    'transaction_fees',
    'microgons_bid',
    'micronots_staked',
    'microgons_to_be_mined',
    'micronots_to_be_mined',
  ];

  public async fetchLatestActiveId(): Promise<number | null> {
    const result = await this.db.sql.select<{ id: number }[]>(
      'SELECT id FROM cohorts WHERE seats_won > 0 ORDER BY id DESC LIMIT 1',
    );
    return result.length > 0 ? result[0].id : null;
  }

  public async fetchById(
    id: number,
  ): Promise<(ICohortRecord & { firstTick: number; lastTick: number; lastBlockNumber: number }) | null> {
    const rawRecords = await this.db.sql.select<any[]>(
      `SELECT cohorts.*, frames.first_tick as first_tick, frames.last_block_number as last_block_number FROM cohorts
      LEFT JOIN frames ON cohorts.id = frames.id
      WHERE seats_won > 0
      AND cohorts.id = ?
      ORDER BY cohorts.id
      DESC LIMIT 1`,
      [id],
    );

    if (rawRecords.length === 0) {
      return null;
    }

    const record = camelcaseKeys(convertSqliteBigInts(rawRecords[0], this.bigIntFields));
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
        COALESCE(sum(transaction_fees), 0) as total_transaction_fees, 
        COALESCE(sum(microgons_bid), 0) as total_microgons_bid
      FROM cohorts`,
      );

      const oldestActiveFrameId = Math.max(1, currentFrameId - 10);
      const [rawActiveStats] = await this.db.sql.select<[any]>(
        `SELECT 
        COALESCE(count(id), 0) as active_cohorts,
        COALESCE(sum(seats_won), 0) as active_seats
      FROM cohorts WHERE id >= ?`,
        [oldestActiveFrameId],
      );

      const totalStats = camelcaseKeys(rawTotalStats);
      const activeStats = camelcaseKeys(rawActiveStats);

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
    const records = await this.db.sql.select<any[]>('SELECT * FROM cohorts WHERE seats_won > 0 AND id >= ?', [
      currentFrameId - 10,
    ]);
    return camelcaseKeys(convertSqliteBigInts(records, this.bigIntFields)) as ICohortRecord[];
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
        transaction_fees, 
        micronots_staked, 
        microgons_bid, 
        seats_won, 
        microgons_to_be_mined, 
        micronots_to_be_mined) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        progress,
        toSqliteBigInt(transactionFees),
        toSqliteBigInt(micronotsStaked),
        toSqliteBigInt(microgonsBid),
        seatsWon,
        toSqliteBigInt(microgonsToBeMined),
        toSqliteBigInt(micronotsToBeMined),
      ],
    );
  }
}
