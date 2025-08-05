import { IFrameBidRecord } from '../../interfaces/db/IFrameBidRecord';
import { BaseTable } from './BaseTable';
import { convertSqliteBigInts, toSqliteBigInt, toSqlParams } from '../Utils';

export class FrameBidsTable extends BaseTable {
  private bigIntFields: string[] = ['microgonsBid'];

  async insertOrUpdate(
    frameId: number,
    confirmedAtBlockNumber: number,
    address: string,
    subAccountIndex: number | undefined,
    microgonsBid: bigint,
    bidPosition: number,
    lastBidAtTick: number | undefined,
  ): Promise<void> {
    await this.db.execute(
      `INSERT INTO FrameBids (
          frameId, confirmedAtBlockNumber, address, subAccountIndex, microgonsBid, bidPosition, lastBidAtTick
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?
        ) ON CONFLICT(frameId, address) DO UPDATE SET 
          confirmedAtBlockNumber = excluded.confirmedAtBlockNumber, 
          subAccountIndex = excluded.subAccountIndex,
          microgonsBid = excluded.microgonsBid, 
          bidPosition = excluded.bidPosition, 
          lastBidAtTick = excluded.lastBidAtTick
      `,
      toSqlParams([
        frameId,
        confirmedAtBlockNumber,
        address,
        subAccountIndex,
        toSqliteBigInt(microgonsBid),
        bidPosition,
        lastBidAtTick,
      ]),
    );
  }

  async fetchForFrameId(frameId: number, limit: number = 100): Promise<IFrameBidRecord[]> {
    const rawRecords = await this.db.select<IFrameBidRecord[]>(
      'SELECT * FROM FrameBids WHERE frameId = ? ORDER BY microgonsBid DESC LIMIT ?',
      [frameId, limit],
    );
    return convertSqliteBigInts(rawRecords, this.bigIntFields);
  }
}
