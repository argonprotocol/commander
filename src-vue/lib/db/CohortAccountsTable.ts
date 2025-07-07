import { ICohortAccountRecord } from '../../interfaces/db/ICohortAccountRecord';
import { BaseTable } from './BaseTable';
import camelcaseKeys from 'camelcase-keys';
import { convertSqliteBigInts, toSqliteBigInt } from '../Utils';

export class CohortAccountsTable extends BaseTable {
  private bigIntFields: string[] = ['microgons_bid'];

  async deleteForCohort(cohortId: number): Promise<void> {
    await this.db.sql.execute('DELETE FROM cohort_accounts WHERE cohort_id = ?', [cohortId]);
  }

  async insert(
    idx: number,
    cohortId: number,
    address: string,
    microgonsBid: bigint,
    bidPosition: number,
  ): Promise<void> {
    await this.db.sql.execute(
      'INSERT INTO cohort_accounts (idx, cohort_id, address, microgons_bid, bid_position) VALUES (?, ?, ?, ?, ?)',
      [idx, cohortId, address, toSqliteBigInt(microgonsBid), bidPosition],
    );
  }

  async fetchForCohortId(cohortId: number): Promise<ICohortAccountRecord[]> {
    const rawRecords = await this.db.sql.select<any[]>('SELECT * FROM cohort_accounts WHERE cohort_id = ?', [cohortId]);
    return camelcaseKeys(convertSqliteBigInts(rawRecords, this.bigIntFields)) as ICohortAccountRecord[];
  }
}
