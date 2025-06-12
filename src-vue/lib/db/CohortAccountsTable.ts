import { ICohortAccountRecord } from '../../interfaces/db/ICohortAccountRecord';
import { BaseTable } from './BaseTable';

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
    const [result] = await this.db.sql.select<[ICohortAccountRecord]>(
      'INSERT INTO cohort_accounts (idx, cohort_id, address, argons_bid, bid_position) VALUES (?, ?, ?, ?, ?) RETURNING *',
      [idx, cohortId, address, argonsBid, bidPosition],
    );
    return result;
  }

  async fetchForCohortId(cohortId: number): Promise<ICohortAccountRecord[]> {
    const result = await this.db.sql.select<ICohortAccountRecord[]>(
      'SELECT * FROM cohort_accounts WHERE cohort_id = ?',
      [cohortId],
    );
    return result;
  }
}
