import { BaseTable, IFieldTypes } from './BaseTable';
import { IBitcoinLock, JsonExt } from '@argonprotocol/mainchain';
import { convertSqliteFields, toSqlParams } from '../Utils.ts';

export interface IRatchet {
  mintAmount: bigint;
  mintPending: bigint;
  securityFee: bigint;
  txFee: bigint;
  burned: bigint;
  blockHeight: number;
  bitcoinBlockHeight: number;
}

export interface IBitcoinLockRecord {
  utxoId: number;
  status: 'initialized' | 'verificationFailed' | 'pendingMint' | 'minted' | 'releaseRequested' | 'vaultCosigned';
  txid?: string;
  vout?: number;
  satoshis: bigint;
  lockPrice: bigint;
  ratchets: IRatchet[]; // array of ratchets
  cosignVersion: string;
  lockDetails: IBitcoinLock;
  requestedReleaseAtHeight?: number;
  releaseBitcoinNetworkFee?: bigint;
  releaseToDestinationAddress?: string;
  releaseCosignSignature?: Uint8Array;
  releaseCosignHeight?: number;
  network: string;
  hdPath: string;
  vaultId: number;
  createdAt: Date;
  updatedAt: Date;
}

export class BitcoinLocksTable extends BaseTable {
  private fields: IFieldTypes = {
    bigintFields: ['satoshis', 'lockPrice', 'releaseBitcoinNetworkFee'],
    jsonFields: ['lockDetails', 'ratchets'],
    dateFields: ['createdAt', 'updatedAt'],
  };

  async insert(
    lock: Omit<IBitcoinLockRecord, 'createdAt' | 'updatedAt' | 'txid' | 'vout'>,
  ): Promise<IBitcoinLockRecord> {
    const [record] = await this.db.sql.select<IBitcoinLockRecord[]>(
      `INSERT INTO BitcoinLocks (
        utxoId, status, satoshis, lockPrice, cosignVersion, lockDetails, network, hdPath, vaultId, ratchets
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      ) RETURNING *`,
      toSqlParams([
        lock.utxoId,
        lock.status || 'initialized',
        lock.satoshis,
        lock.lockPrice,
        lock.cosignVersion,
        lock.lockDetails,
        lock.network,
        lock.hdPath,
        lock.vaultId,
        lock.ratchets,
      ]),
    );
    return record;
  }

  async getNextVaultHdKeyIndex(vaultId: number): Promise<number> {
    const { latestIndex } = await this.db.sql.select<{ latestIndex: number }>(
      `INSERT INTO BitcoinLockVaultHdSeq (vaultId, latestIndex) VALUES ($1, $2)
       ON CONFLICT (vaultId) DO UPDATE SET latestIndex = BitcoinLockVaultHdSeq.latestIndex + 1
       RETURNING latestIndex`,
      [vaultId, 0],
    );

    return latestIndex;
  }

  async requestedRelease(
    lock: IBitcoinLockRecord,
    height: number,
    toDestinationAddress: string,
    networkFee: bigint,
  ): Promise<void> {
    lock.status = 'releaseRequested';
    lock.requestedReleaseAtHeight = height;
    lock.releaseToDestinationAddress = toDestinationAddress;
    lock.releaseBitcoinNetworkFee = networkFee;
    await this.db.sql.execute(
      `UPDATE BitcoinLocks SET status = 'releaseRequested', requestedReleaseAtHeight=$2, releaseToDestinationAddress=$3, releaseBitcoinNetworkFee=$4 WHERE utxoId = $1`,
      toSqlParams([
        lock.utxoId,
        lock.requestedReleaseAtHeight,
        lock.releaseToDestinationAddress,
        lock.releaseBitcoinNetworkFee,
      ]),
    );
  }

  async fetchAll(): Promise<IBitcoinLockRecord[]> {
    return await this.db.sql
      .select<IBitcoinLockRecord[]>('SELECT * FROM BitcoinLocks ORDER BY createdAt DESC', [])
      .then(x => {
        return x.map(rawRecord => convertSqliteFields(rawRecord, this.fields));
      });
  }

  async saveNewRatchet(lock: IBitcoinLockRecord): Promise<void> {
    await this.db.sql.execute(
      `UPDATE BitcoinLocks SET lockPrice = $2, lockDetails = $3, ratchets = $4 WHERE utxoId = $1`,
      toSqlParams([lock.utxoId, lock.lockPrice, lock.lockDetails, lock.ratchets]),
    );
  }

  async saveRatchetUpdates(lock: IBitcoinLockRecord): Promise<void> {
    const ratchets = JsonExt.stringify(lock.ratchets);
    await this.db.sql.execute(
      `UPDATE BitcoinLocks SET ratchets = $2, status = $3 WHERE utxoId = $1`,
      toSqlParams([lock.utxoId, ratchets, lock.status]),
    );
  }

  async recordCosigned(lock: IBitcoinLockRecord, signature: Uint8Array, atHeight: number): Promise<void> {
    lock.status = 'vaultCosigned';
    lock.releaseCosignSignature = signature;
    lock.releaseCosignHeight = atHeight;
    await this.db.sql.execute(
      'UPDATE BitcoinLocks SET status = $1, releaseCosignSignature = $2, releaseCosignHeight = $3 WHERE utxoId = $4',
      toSqlParams([lock.status, lock.releaseCosignSignature, lock.releaseCosignHeight, lock.utxoId]),
    );
  }

  async recordVerifiedStatus(lock: IBitcoinLockRecord) {
    await this.db.sql.execute(
      'UPDATE BitcoinLocks SET status = $1, txid = $2, vout = $3 WHERE utxoId = $4',
      toSqlParams([lock.status, lock.txid, lock.vout, lock.utxoId]),
    );
  }
}
