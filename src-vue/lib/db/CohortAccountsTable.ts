import { ICohortAccountRecord } from '../../interfaces/db/ICohortAccountRecord';
import { BaseTable } from './BaseTable';
import camelcaseKeys from 'camelcase-keys';

export class CohortAccountsTable extends BaseTable {
  async deleteForCohort(cohortId: number): Promise<void> {
    await this.db.sql.execute('DELETE FROM cohort_accounts WHERE cohort_id = ?', [cohortId]);
  }

  async insert(
    idx: number,
    cohortId: number,
    address: string,
    argonsBid: number,
    bidPosition: number,
  ): Promise<ICohortAccountRecord> {
    const [rawRecord] = await this.db.sql.select<[any]>(
      'INSERT INTO cohort_accounts (idx, cohort_id, address, argons_bid, bid_position) VALUES (?, ?, ?, ?, ?) RETURNING *',
      [idx, cohortId, address, argonsBid, bidPosition],
    );
    return camelcaseKeys(rawRecord) as ICohortAccountRecord;
  }

  async fetchForCohortId(cohortId: number): Promise<ICohortAccountRecord[]> {
    const rawRecords = await this.db.sql.select<any[]>('SELECT * FROM cohort_accounts WHERE cohort_id = ?', [cohortId]);
    return camelcaseKeys(rawRecords) as ICohortAccountRecord[];
  }
}
