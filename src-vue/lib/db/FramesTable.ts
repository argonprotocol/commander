import { IFrameRecord } from '../../interfaces/db/IFrameRecord';
import { BaseTable } from './BaseTable';
import camelcaseKeys from 'camelcase-keys';
import { toSqliteBnJson, toSqliteBoolean, convertSqliteFields } from '../Utils';
import BigNumber from 'bignumber.js';

export class FramesTable extends BaseTable {
  private booleanFields: string[] = ['is_processed'];
  private bnJsonFields: string[] = ['usd_exchange_rates', 'btc_exchange_rates', 'argnot_exchange_rates'];

  async insertOrUpdate(
    id: number,
    firstTick: number,
    lastTick: number,
    firstBlockNumber: number,
    lastBlockNumber: number,
    usdExchangeRates: BigNumber[],
    btcExchangeRates: BigNumber[],
    argnotExchangeRates: BigNumber[],
    progress: number,
    isProcessed: boolean,
  ): Promise<void> {
    const argnotExchangeRatesStr = toSqliteBnJson(argnotExchangeRates);
    const usdExchangeRatesStr = toSqliteBnJson(usdExchangeRates);
    const btcExchangeRatesStr = toSqliteBnJson(btcExchangeRates);

    await this.db.sql.execute(
      'INSERT OR REPLACE INTO frames (id, first_tick, last_tick, first_block_number, last_block_number, usd_exchange_rates, btc_exchange_rates, argnot_exchange_rates, progress, is_processed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        firstTick,
        lastTick,
        firstBlockNumber,
        lastBlockNumber,
        usdExchangeRatesStr,
        btcExchangeRatesStr,
        argnotExchangeRatesStr,
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
    usdExchangeRates: BigNumber[],
    btcExchangeRates: BigNumber[],
    argnotExchangeRates: BigNumber[],
    progress: number,
    isProcessed: boolean,
  ): Promise<void> {
    const usdExchangeRatesStr = toSqliteBnJson(usdExchangeRates);
    const btcExchangeRatesStr = toSqliteBnJson(btcExchangeRates);
    const argnotExchangeRatesStr = toSqliteBnJson(argnotExchangeRates);

    await this.db.sql.execute(
      'UPDATE frames SET first_tick = ?, last_tick = ?, first_block_number = ?, last_block_number = ?, usd_exchange_rates = ?, btc_exchange_rates = ?, argnot_exchange_rates = ?, progress = ?, is_processed = ? WHERE id = ?',
      [
        firstTick,
        lastTick,
        firstBlockNumber,
        lastBlockNumber,
        usdExchangeRatesStr,
        btcExchangeRatesStr,
        argnotExchangeRatesStr,
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
        bnJson: this.bnJsonFields,
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
