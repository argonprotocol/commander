import { ICohortRecordWithTicks, ICohortRecord } from '../../interfaces/db/ICohortRecord';
import { BaseTable } from './BaseTable';

export class CohortsTable extends BaseTable {
  public async fetchLatestActiveId(): Promise<number | null> {
    const result = await this.db.sql.select<{ id: number }[]>(
      'SELECT id FROM cohorts WHERE seats_won > 0 ORDER BY id DESC LIMIT 1',
    );
    return result.length > 0 ? result[0].id : null;
  }

  public async fetchById(id: number): Promise<ICohortRecordWithTicks | null> {
    const result = await this.db.sql.select<ICohortRecordWithTicks[]>(
      `SELECT cohorts.*, frames.tick_start as frameTickStart FROM cohorts
      LEFT JOIN frames ON cohorts.id = frames.id
      WHERE seats_won > 0
      AND cohorts.id = ?
      ORDER BY cohorts.id
      DESC LIMIT 1`,
      [id],
    );

    if (result.length === 0) {
      return null;
    }

    const record = result[0];
    return {
      ...record,
      frameTickEnd: record.frameTickStart + 1440 * 10,
    };
  }

  public async fetchGlobalStats(currentFrameId: number): Promise<{
    totalActiveCohorts: number;
    totalActiveSeats: number;
    totalTransactionFees: number;
    totalArgonsBid: number;
  }> {
    const [totalStats] = await this.db.sql.select<
      [
        {
          total_transaction_fees: number;
          total_argons_bid: number;
        },
      ]
    >(
      `SELECT 
        COALESCE(sum(transaction_fees), 0) as total_transaction_fees, 
        COALESCE(sum(argons_bid), 0) as total_argons_bid
      FROM cohorts`,
    );

    const oldestActiveFrameId = Math.max(1, currentFrameId - 10);
    const [activeStats] = await this.db.sql.select<
      [
        {
          active_cohorts: number;
          active_seats: number;
        },
      ]
    >(
      `SELECT 
        COALESCE(count(id), 0) as active_cohorts,
        COALESCE(sum(seats_won), 0) as active_seats
      FROM cohorts WHERE id >= ?`,
      [oldestActiveFrameId],
    );

    return {
      totalActiveCohorts: activeStats.active_cohorts,
      totalActiveSeats: activeStats.active_seats,
      totalTransactionFees: totalStats.total_transaction_fees,
      totalArgonsBid: totalStats.total_argons_bid,
    };
  }

  async insertOrUpdate(
    id: number,
    progress: number,
    transactionFees: number,
    argonotsStaked: number,
    argonsBid: number,
    seatsWon: number,
  ): Promise<ICohortRecord> {
    const [result] = await this.db.sql.select<[ICohortRecord]>(
      'INSERT OR REPLACE INTO cohorts (id, progress, transaction_fees, argonots_staked, argons_bid, seats_won) VALUES (?, ?, ?, ?, ?, ?) RETURNING *',
      [id, progress, transactionFees, argonotsStaked, argonsBid, seatsWon],
    );
    return result;
  }
}
