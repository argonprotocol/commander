import { IFrameRecord } from '../../interfaces/db/IFrameRecord';
import { BaseTable, IFieldTypes } from './BaseTable';
import { calculateAPR, convertFromSqliteFields, toSqlParams } from '../Utils';
import { bigNumberToBigInt } from '@argonprotocol/commander-calculator';
import BigNumber from 'bignumber.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { TICK_MILLIS } from '../Config.ts';
import { IDashboardFrameStats } from '../../interfaces/IStats.ts';

dayjs.extend(utc);

export class FramesTable extends BaseTable {
  private fieldTypes: IFieldTypes = {
    boolean: ['isProcessed'],
    bigintJson: ['microgonToUsd', 'microgonToBtc', 'microgonToArgonot'],
    bigint: ['totalSeatCost', 'microgonsMined', 'microgonsMinted', 'micronotsMined'],
  };

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
    await this.db.execute(
      'INSERT OR REPLACE INTO Frames (id, firstTick, lastTick, firstBlockNumber, lastBlockNumber, microgonToUsd, microgonToBtc, microgonToArgonot, progress, isProcessed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      toSqlParams([
        id,
        firstTick,
        lastTick,
        firstBlockNumber,
        lastBlockNumber,
        microgonToUsd,
        microgonToBtc,
        microgonToArgonot,
        progress,
        isProcessed,
      ]),
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
    activeSeatCount: number,
    totalSeatCost: bigint,
    blocksMined: number,
    micronotsMined: bigint,
    microgonsMined: bigint,
    microgonsMinted: bigint,
    progress: number,
    isProcessed: boolean,
  ): Promise<void> {
    await this.db.execute(
      `UPDATE Frames SET 
        firstTick = ?, 
        lastTick = ?, 
        firstBlockNumber = ?, 
        lastBlockNumber = ?, 
        microgonToUsd = ?, 
        microgonToBtc = ?, 
        microgonToArgonot = ?, 
        activeSeatCount = ?, 
        totalSeatCost = ?,
        blocksMined = ?, 
        micronotsMined = ?, 
        microgonsMined = ?, 
        microgonsMinted = ?, 
        progress = ?, 
        isProcessed = ? 
      WHERE id = ?`,
      toSqlParams([
        firstTick,
        lastTick,
        firstBlockNumber,
        lastBlockNumber,
        microgonToUsd,
        microgonToBtc,
        microgonToArgonot,
        activeSeatCount,
        totalSeatCost,
        blocksMined,
        micronotsMined,
        microgonsMined,
        microgonsMinted,
        progress,
        isProcessed,
        id,
      ]),
    );
  }

  async fetchLastYear(): Promise<Omit<IDashboardFrameStats, 'score'>[]> {
    const rawRecords = await this.db.select<any[]>(`SELECT 
      id, firstTick, lastTick, microgonToUsd, microgonToArgonot, activeSeatCount, totalSeatCost, blocksMined, micronotsMined, microgonsMined, microgonsMinted, progress
    FROM Frames ORDER BY id DESC LIMIT 365`);

    const records = convertFromSqliteFields(rawRecords, this.fieldTypes).map((x: any) => {
      const date = dayjs
        .utc(x.firstTick * TICK_MILLIS)
        .local()
        .format('YYYY-MM-DD');

      const relativeSeatCostBn = BigNumber(x.totalSeatCost).multipliedBy(x.progress / 100);
      const relativeSeatCost = bigNumberToBigInt(relativeSeatCostBn);
      const microgonValueEarnedBn = BigNumber(x.microgonsMined).plus(x.microgonsMinted).plus(x.micronotsMined);
      const microgonValueOfRewards = bigNumberToBigInt(microgonValueEarnedBn);
      const profit = BigNumber(microgonValueEarnedBn).minus(relativeSeatCostBn).toNumber();
      const apr = calculateAPR(relativeSeatCost, microgonValueOfRewards);

      return {
        id: x.id,
        date,
        firstTick: x.firstTick,
        lastTick: x.lastTick,
        activeSeatCount: x.activeSeatCount,
        relativeSeatCost: relativeSeatCost,
        blocksMined: x.blocksMined,
        microgonToUsd: x.microgonToUsd,
        microgonToArgonot: x.microgonToArgonot,

        microgonsMined: x.microgonsMined,
        microgonsMinted: x.microgonsMinted,
        micronotsMined: x.micronotsMined,

        microgonValueOfRewards,
        progress: x.progress,
        profit,
        apr,
      };
    });

    while (records.length < 365) {
      const lastRecord = records[records.length - 1];
      const previousDay = dayjs.utc(lastRecord.date).subtract(1, 'day');
      if (previousDay.isBefore(dayjs.utc('2025-01-01'))) {
        break;
      }

      records.push({
        id: 0,
        date: previousDay.local().format('YYYY-MM-DD'),
        firstTick: lastRecord.firstTick - 1_440,
        lastTick: lastRecord.lastTick - 1_440,
        activeSeatCount: 0,
        blocksMined: 0,
        microgonsCollected: 0,
        micronotsCollected: 0,
        progress: 0,
        relativeCost: 0,
        revenue: 0,
        profit: 0,
        apr: 0,
      });
    }

    return records;
  }

  async fetchById(id: number): Promise<IFrameRecord> {
    const [rawRecord] = await this.db.select<[any]>('SELECT * FROM Frames WHERE id = ?', [id]);
    if (!rawRecord) throw new Error(`Frame ${id} not found`);

    return convertFromSqliteFields(rawRecord, this.fieldTypes) as IFrameRecord;
  }

  async fetchProcessedCount(): Promise<number> {
    const [result] = await this.db.select<[{ count: number }]>(
      'SELECT COUNT(*) as count FROM Frames WHERE isProcessed = 1',
    );
    return result.count;
  }

  async latestId(): Promise<number> {
    const [rawRecord] = await this.db.select<[{ maxId: number }]>('SELECT COALESCE(MAX(id), 0) as maxId FROM Frames');
    return rawRecord.maxId;
  }
}
