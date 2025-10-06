import { BaseTable, IFieldTypes } from './BaseTable';
import { IBitcoinLock } from '@argonprotocol/mainchain';
import { JsonExt } from '@argonprotocol/commander-core';
import { convertFromSqliteFields, toSqlParams } from '../Utils.ts';

export interface IRatchet {
  mintAmount: bigint;
  mintPending: bigint;
  peggedPrice: bigint;
  securityFee: bigint;
  txFee: bigint;
  burned: bigint;
  blockHeight: number;
  bitcoinBlockHeight: number;
}

export interface IBitcoinLockRecord {
  utxoId: number;
  status:
    | 'initialized'
    | 'verificationFailed'
    | 'pendingMint'
    | 'minted'
    | 'releaseRequested'
    | 'vaultCosigned'
    | 'released';
  txid?: string;
  vout?: number;
  satoshis: bigint;
  liquidityPromised: bigint;
  peggedPrice: bigint;
  ratchets: IRatchet[]; // array of ratchets
  cosignVersion: string;
  lockDetails: IBitcoinLock;
  requestedReleaseAtHeight?: number;
  releaseBitcoinNetworkFee?: bigint;
  releaseToDestinationAddress?: string;
  releaseCosignSignature?: Uint8Array;
  releaseCosignHeight?: number;
  releasedAtHeight?: number;
  releasedTxId?: string;
  network: string;
  hdPath: string;
  vaultId: number;
  createdAt: Date;
  updatedAt: Date;
}

export class BitcoinLocksTable extends BaseTable {
  private fieldTypes: IFieldTypes = {
    bigint: ['satoshis', 'peggedPrice', 'liquidityPromised', 'releaseBitcoinNetworkFee'],
    json: ['lockDetails', 'ratchets'],
    date: ['createdAt', 'updatedAt'],
  };

  async insert(
    lock: Omit<IBitcoinLockRecord, 'createdAt' | 'updatedAt' | 'txid' | 'vout'>,
  ): Promise<IBitcoinLockRecord> {
    const result = await this.db.execute(
      `INSERT INTO BitcoinLocks (
        utxoId, status, satoshis, liquidityPromised, peggedPrice, cosignVersion, lockDetails, network, hdPath, vaultId, ratchets
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )`,
      toSqlParams([
        lock.utxoId,
        lock.status || 'initialized',
        lock.satoshis,
        lock.liquidityPromised,
        lock.peggedPrice,
        lock.cosignVersion,
        lock.lockDetails,
        lock.network,
        lock.hdPath,
        lock.vaultId,
        lock.ratchets,
      ]),
    );
    if (!result || result.rowsAffected === 0) {
      throw new Error(`Failed to insert Bitcoin lock with utxoId ${lock.utxoId}`);
    }
    const record = await this.get(lock.utxoId);
    if (!record) {
      throw new Error(`Failed to insert Bitcoin lock with utxoId ${lock.utxoId}`);
    }
    return record;
  }

  async getNextVaultHdKeyIndex(vaultId: number): Promise<number> {
    const [{ latestIndex }] = await this.db.select<{ latestIndex: number }[]>(
      `INSERT INTO BitcoinLockVaultHdSeq (vaultId, latestIndex) VALUES ($1, $2)
       ON CONFLICT (vaultId) DO UPDATE SET latestIndex = BitcoinLockVaultHdSeq.latestIndex + 1
       RETURNING latestIndex`,
      toSqlParams([vaultId, 0]),
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
    await this.db.execute(
      `UPDATE BitcoinLocks SET status = 'releaseRequested', requestedReleaseAtHeight=$2, releaseToDestinationAddress=$3, releaseBitcoinNetworkFee=$4 WHERE utxoId = $1`,
      toSqlParams([
        lock.utxoId,
        lock.requestedReleaseAtHeight,
        lock.releaseToDestinationAddress,
        lock.releaseBitcoinNetworkFee,
      ]),
    );
  }

  async get(utxoId: number): Promise<IBitcoinLockRecord | undefined> {
    const rawRecords = await this.db.select<IBitcoinLockRecord[]>(
      'SELECT * FROM BitcoinLocks WHERE utxoId = $1',
      toSqlParams([utxoId]),
    );
    if (rawRecords.length === 0) return undefined;
    return convertFromSqliteFields(rawRecords[0], this.fieldTypes);
  }

  async fetchAll(): Promise<IBitcoinLockRecord[]> {
    return await this.db
      .select<IBitcoinLockRecord[]>('SELECT * FROM BitcoinLocks ORDER BY createdAt DESC', [])
      .then(x => {
        return x.map(rawRecord => convertFromSqliteFields(rawRecord, this.fieldTypes));
      });
  }

  async saveNewRatchet(lock: IBitcoinLockRecord): Promise<void> {
    await this.db.execute(
      `UPDATE BitcoinLocks SET peggedPrice = $2, liquidityPromised = $3, lockDetails = $4, ratchets = $5 WHERE utxoId = $1`,
      toSqlParams([lock.utxoId, lock.peggedPrice, lock.liquidityPromised, lock.lockDetails, lock.ratchets]),
    );
  }

  async saveRatchetUpdates(lock: IBitcoinLockRecord): Promise<void> {
    const ratchets = JsonExt.stringify(lock.ratchets);
    await this.db.execute(
      `UPDATE BitcoinLocks SET ratchets = $2, status = $3 WHERE utxoId = $1`,
      toSqlParams([lock.utxoId, ratchets, lock.status]),
    );
  }

  async recordCosigned(lock: IBitcoinLockRecord, signature: Uint8Array, atHeight: number): Promise<void> {
    lock.status = 'vaultCosigned';
    lock.releaseCosignSignature = signature;
    lock.releaseCosignHeight = atHeight;
    await this.db.execute(
      'UPDATE BitcoinLocks SET status = $1, releaseCosignSignature = $2, releaseCosignHeight = $3 WHERE utxoId = $4',
      toSqlParams([lock.status, lock.releaseCosignSignature, lock.releaseCosignHeight, lock.utxoId]),
    );
  }

  async recordVerifiedStatus(lock: IBitcoinLockRecord) {
    await this.db.execute(
      'UPDATE BitcoinLocks SET status = $1, txid = $2, vout = $3 WHERE utxoId = $4',
      toSqlParams([lock.status, lock.txid, lock.vout, lock.utxoId]),
    );
  }

  async recordReleaseTxid(lock: IBitcoinLockRecord): Promise<void> {
    await this.db.execute(
      'UPDATE BitcoinLocks SET status = $1, releasedAtHeight = $2, releasedTxId = $3 WHERE utxoId = $4',
      toSqlParams([lock.status, lock.releasedAtHeight, lock.releasedTxId, lock.utxoId]),
    );
  }
}
