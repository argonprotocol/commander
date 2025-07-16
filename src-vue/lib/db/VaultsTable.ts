import { BaseTable } from './BaseTable';
import { convertSqliteFields } from '../Utils';

export interface IVaultRecord {
  id: number;
  hdPath: string;
  createdAtBlockHeight: number;
  lastTermsUpdateHeight?: number;
  isClosed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class VaultsTable extends BaseTable {
  dateFields: string[] = ['createdAt', 'updatedAt'];

  async insert(vaultId: number, hdPath: string, createdAtBlokcHeight: number): Promise<void> {
    await this.db.sql.execute('INSERT INTO vaults (id, hdPath, createdAtBlockHeight) VALUES (?, ?, ?)', [
      vaultId,
      hdPath,
      createdAtBlokcHeight,
    ]);
  }

  async updatedTerms(vaultId: number, updatedAtBlokcHeight: number): Promise<void> {
    await this.db.sql.execute(
      'UPDATE vaults SET lastTermsUpdateHeight = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [updatedAtBlokcHeight, vaultId],
    );
  }

  async fetchAll(): Promise<IVaultRecord[]> {
    const rawRecords = await this.db.sql.select<IVaultRecord[]>('SELECT * FROM vaults', []);
    return convertSqliteFields(rawRecords, this);
  }
}
