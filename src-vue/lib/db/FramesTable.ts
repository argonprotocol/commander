import { IFrameRecord } from '../../interfaces/db/IFrameRecord';
import { BaseTable } from './BaseTable';
import camelcaseKeys from 'camelcase-keys';
import { toSqliteBoolean, convertSqliteFields, jsonStringifyWithBigInts } from '../Utils';

export class FramesTable extends BaseTable {
  private booleanFields: string[] = ['is_processed'];
  private bigintJsonFields: string[] = ['microgon_to_usd', 'microgon_to_btc', 'microgon_to_argonot'];

  async insertOrUpdate(
    id: number,
    firstTick: number,
    lastTick: number,
    firstBlockNumber: number,
    lastBlockNumber: number,
    microgonToUsd: bigint[],
    microgonToBtc: bigint[],
    microgonToArgonot: bigint[],
    progress: number,
    isProcessed: boolean,
  ): Promise<void> {
    const microgonToUsdStr = jsonStringifyWithBigInts(microgonToUsd);
    const microgonToBtcStr = jsonStringifyWithBigInts(microgonToBtc);
    const microgonToArgonotStr = jsonStringifyWithBigInts(microgonToArgonot);

    await this.db.sql.execute(
      'INSERT OR REPLACE INTO frames (id, first_tick, last_tick, first_block_number, last_block_number, microgon_to_usd, microgon_to_btc, microgon_to_argonot, progress, is_processed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        firstTick,
        lastTick,
        firstBlockNumber,
        lastBlockNumber,
        microgonToUsdStr,
        microgonToBtcStr,
        microgonToArgonotStr,
        progress,
        toSqliteBoolean(isProcessed),
      ],
    );
  }

  async update(
    id: number,
    firstTick: number,
    lastTick: number,
    firstBlockNumber: number,
    lastBlockNumber: number,
    microgonToUsd: bigint[],
    microgonToBtc: bigint[],
    microgonToArgonot: bigint[],
    progress: number,
    isProcessed: boolean,
  ): Promise<void> {
    const microgonToUsdStr = jsonStringifyWithBigInts(microgonToUsd);
    const microgonToBtcStr = jsonStringifyWithBigInts(microgonToBtc);
    const microgonToArgonotStr = jsonStringifyWithBigInts(microgonToArgonot);

    await this.db.sql.execute(
      'UPDATE frames SET first_tick = ?, last_tick = ?, first_block_number = ?, last_block_number = ?, microgon_to_usd = ?, microgon_to_btc = ?, microgon_to_argonot = ?, progress = ?, is_processed = ? WHERE id = ?',
      [
        firstTick,
        lastTick,
        firstBlockNumber,
        lastBlockNumber,
        microgonToUsdStr,
        microgonToBtcStr,
        microgonToArgonotStr,
        progress,
        toSqliteBoolean(isProcessed),
        id,
      ],
    );
  }

  async fetchById(id: number): Promise<IFrameRecord> {
    const [rawRecord] = await this.db.sql.select<[any]>('SELECT * FROM frames WHERE id = ?', [id]);
    if (!rawRecord) throw new Error(`Frame ${id} not found`);

    return camelcaseKeys(
      convertSqliteFields(rawRecord, {
        boolean: this.booleanFields,
        bigintJson: this.bigintJsonFields,
      }),
    ) as IFrameRecord;
  }

  async fetchProcessedCount(): Promise<number> {
    const [result] = await this.db.sql.select<[{ count: number }]>(
      'SELECT COUNT(*) as count FROM frames WHERE is_processed = 1',
    );
    return result.count;
  }

  async latestId(): Promise<number> {
    const [rawRecord] = await this.db.sql.select<[{ max_id: number }]>(
      'SELECT COALESCE(MAX(id), 0) as max_id FROM frames',
    );
    return rawRecord.max_id;
  }
}
