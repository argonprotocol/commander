import { MiningFrames } from '@argonprotocol/commander-bot/src/MiningFrames';
import { ICohortRecord } from '../../interfaces/db/ICohortRecord';
import { BaseTable } from './BaseTable';
import camelcaseKeys from 'camelcase-keys';
import { getMainchainClient } from '../../stores/mainchain';

export class CohortsTable extends BaseTable {
  public async fetchLatestActiveId(): Promise<number | null> {
    const result = await this.db.sql.select<{ id: number }[]>(
      'SELECT id FROM cohorts WHERE seats_won > 0 ORDER BY id DESC LIMIT 1',
    );
    return result.length > 0 ? result[0].id : null;
  }

  public async fetchById(
    id: number,
  ): Promise<
    (ICohortRecord & { firstTick: number; lastTick: number; lastBlockNumber: number }) | null
  > {
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

    const record = camelcaseKeys(rawRecords[0]);
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
    totalTransactionFees: number;
    totalArgonsBid: number;
  }> {
    const [rawTotalStats] = await this.db.sql.select<[any]>(
      `SELECT 
        COALESCE(sum(transaction_fees), 0) as total_transaction_fees, 
        COALESCE(sum(argons_bid), 0) as total_argons_bid
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
      totalTransactionFees: totalStats.totalTransactionFees,
      totalArgonsBid: totalStats.totalArgonsBid,
    };
  }

  async insertOrUpdate(
    id: number,
    progress: number,
    transactionFees: number,
    argonotsStaked: number,
    argonsBid: number,
    seatsWon: number,
  ): Promise<void> {
    await this.db.sql.execute(
      'INSERT OR REPLACE INTO cohorts (id, progress, transaction_fees, argonots_staked, argons_bid, seats_won) VALUES (?, ?, ?, ?, ?, ?)',
      [id, progress, transactionFees, argonotsStaked, argonsBid, seatsWon],
    );
  }
}
