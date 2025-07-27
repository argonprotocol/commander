import { BaseTable, IFieldTypes } from './BaseTable';
import { convertFromSqliteFields, toSqlParams } from '../Utils';

export interface IVaultRecord {
  id: number;
  hdPath: string;
  createdAtBlockHeight: number;
  lastTermsUpdateHeight?: number;
  lastCollectTick?: number;
  personalUtxoId?: number;
  /**
   * The amount of microgons that have been prebonded to this vault as well as tip and fee
   */
  prebondedMicrogonsIncludingFee?: bigint;
  prebondedMicrogonsAtTick?: number;
  isClosed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class VaultsTable extends BaseTable {
  private fieldTypes: IFieldTypes = {
    date: ['createdAt', 'updatedAt'],
    bigint: ['prebondedMicrogonsIncludingFee'],
  };

  async insert(vaultId: number, hdPath: string, updatedAtBlockHeight: number): Promise<IVaultRecord> {
    const result = await this.db.select<IVaultRecord[]>(
      'INSERT INTO Vaults (id, hdPath, createdAtBlockHeight) VALUES (?, ?, ?) returning *',
      toSqlParams([vaultId, hdPath, updatedAtBlockHeight]),
    );
    if (!result || result.length === 0) {
      throw new Error(`Failed to insert vault with id ${vaultId}`);
    }
    return convertFromSqliteFields(result, this.fieldTypes)[0];
  }

  async save(record: IVaultRecord): Promise<void> {
    await this.db.execute(
      'UPDATE Vaults SET prebondedMicrogonsIncludingFee = ?, prebondedMicrogonsAtTick = ?, lastCollectTick = ?, lastTermsUpdateHeight = ?, ' +
        'personalUtxoId = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      toSqlParams([
        record.prebondedMicrogonsIncludingFee,
        record.prebondedMicrogonsAtTick,
        record.lastCollectTick,
        record.lastTermsUpdateHeight,
        record.personalUtxoId,
        record.id,
      ]),
    );
  }

  async get(): Promise<IVaultRecord | undefined> {
    const rawRecords = await this.db.select<IVaultRecord[]>('SELECT * FROM Vaults LIMIT 1', []);
    return convertFromSqliteFields(rawRecords, this.fieldTypes)[0];
  }
}
