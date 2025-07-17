import { IFrameBidRecord } from '../../interfaces/db/IFrameBidRecord';
import { BaseTable } from './BaseTable';
import { convertSqliteBigInts, toSqliteBigInt, toSqlParams } from '../Utils';

export class FrameBidsTable extends BaseTable {
  private bigIntFields: string[] = ['microgonsBid'];

  async insertOrUpdate(
    frameId: number,
    address: string,
    subAccountIndex: number | undefined,
    microgonsBid: bigint,
    bidPosition: number,
    lastBidAtTick: number | undefined,
  ): Promise<void> {
    await this.db.sql.execute(
      'INSERT OR REPLACE INTO FrameBids (frameId, address, subAccountIndex, microgonsBid, bidPosition, lastBidAtTick) VALUES (?, ?, ?, ?, ?, ?)',
      toSqlParams([frameId, address, subAccountIndex, toSqliteBigInt(microgonsBid), bidPosition, lastBidAtTick]),
    );
  }

  async fetchForFrameId(frameId: number, limit: number = 100): Promise<IFrameBidRecord[]> {
    const rawRecords = await this.db.sql.select<IFrameBidRecord[]>(
      'SELECT * FROM FrameBids WHERE frameId = ? ORDER BY microgonsBid DESC LIMIT ?',
      [frameId, limit],
    );
    return convertSqliteBigInts(rawRecords, this.bigIntFields);
  }
}
