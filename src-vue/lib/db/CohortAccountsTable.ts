import { ICohortAccountRecord } from '../../interfaces/db/ICohortAccountRecord';
import { BaseTable } from './BaseTable';
import { convertSqliteBigInts, toSqliteBigInt } from '../Utils';

export class CohortAccountsTable extends BaseTable {
  private bigIntFields: string[] = ['microgonsBid'];

  async deleteForCohort(cohortId: number): Promise<void> {
    await this.db.execute('DELETE FROM CohortAccounts WHERE cohortId = ?', [cohortId]);
  }

  async insert(
    idx: number,
    cohortId: number,
    address: string,
    microgonsBid: bigint,
    bidPosition: number,
  ): Promise<void> {
    await this.db.execute(
      'INSERT INTO CohortAccounts (idx, cohortId, address, microgonsBid, bidPosition) VALUES (?, ?, ?, ?, ?)',
      [idx, cohortId, address, toSqliteBigInt(microgonsBid), bidPosition],
    );
  }

  async fetchForCohortId(cohortId: number): Promise<ICohortAccountRecord[]> {
    const rawRecords = await this.db.select<ICohortAccountRecord[]>('SELECT * FROM CohortAccounts WHERE cohortId = ?', [
      cohortId,
    ]);
    return convertSqliteBigInts(rawRecords, this.bigIntFields);
  }
}
