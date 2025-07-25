import { BaseTable, IFieldTypes } from './BaseTable';
import { convertFromSqliteFields } from '../Utils';

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
  private fieldTypes: IFieldTypes = {
    date: ['createdAt', 'updatedAt'],
  };

  async insert(vaultId: number, hdPath: string, createdAtBlokcHeight: number): Promise<void> {
    await this.db.execute('INSERT INTO Vaults (id, hdPath, createdAtBlockHeight) VALUES (?, ?, ?)', [
      vaultId,
      hdPath,
      createdAtBlokcHeight,
    ]);
  }

  async updatedTerms(vaultId: number, updatedAtBlokcHeight: number): Promise<void> {
    await this.db.execute('UPDATE Vaults SET lastTermsUpdateHeight = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [
      updatedAtBlokcHeight,
      vaultId,
    ]);
  }

  async fetchAll(): Promise<IVaultRecord[]> {
    const rawRecords = await this.db.select<IVaultRecord[]>('SELECT * FROM Vaults', []);
    return convertFromSqliteFields(rawRecords, this.fieldTypes);
  }
}
