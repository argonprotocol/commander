import { getMainchainClient } from '../stores/mainchain.ts';
import {
  addressBytesHex,
  BitcoinNetwork,
  CosignScript,
  getBitcoinNetworkFromApi,
  getChildXpriv,
  getCompressedPubkey,
  p2wshScriptHexToAddress,
} from '@argonprotocol/bitcoin';
import {
  BitcoinLocks,
  Header,
  type IBitcoinLockConfig,
  ITxProgressCallback,
  KeyringPair,
  TxResult,
  Vault,
} from '@argonprotocol/mainchain';
import { Db } from './Db.ts';
import { BitcoinLocksTable, IBitcoinLockRecord } from './db/BitcoinLocksTable.ts';
import { useVaults } from '../stores/vaults.ts';
import { createDeferred, IDeferred } from './Utils.ts';
import { BITCOIN_BLOCK_MILLIS, ESPLORA_HOST } from './Env.ts';
import { type AddressTxsUtxo } from '@mempool/mempool.js/lib/interfaces/bitcoin/addresses';
import { type TxStatus } from '@mempool/mempool.js/lib/interfaces/bitcoin/transactions';
import { MiningFrames } from '@argonprotocol/commander-core';

export default class BitcoinLocksStore {
  data: {
    locksById: { [utxoId: number]: IBitcoinLockRecord };
    bitcoinBlockHeight: number;
    bitcoinNetwork: BitcoinNetwork;
    latestBlockHeight: number;
  };

  private get locksById() {
    return this.data.locksById;
  }

  private get bitcoinBlockHeight() {
    return this.data.bitcoinBlockHeight;
  }

  private get bitcoinNetwork() {
    return this.data.bitcoinNetwork;
  }

  #config!: IBitcoinLockConfig;
  #lockTicksPerDay!: number;
  #bitcoinLocksApi!: BitcoinLocks;
  #subscription?: () => void;
  #waitForLoad?: IDeferred;

  constructor(readonly dbPromise: Promise<Db>) {
    this.data = {
      locksById: {},
      bitcoinBlockHeight: 0,
      bitcoinNetwork: BitcoinNetwork.Bitcoin,
      latestBlockHeight: 0,
    };
  }

  approximateExpirationTime(lock: IBitcoinLockRecord): number {
    if (!this.#config) {
      throw new Error('Bitcoin lock configuration is not loaded for expiration time.');
    }
    const bitcoinBlockHeight = this.bitcoinBlockHeight;
    const expirationBlock = lock.lockDetails.vaultClaimHeight;
    if (expirationBlock <= bitcoinBlockHeight) {
      return 0; // Already expired
    }
    const lockReleaseCosignDeadlineFrames = this.#config?.lockReleaseCosignDeadlineFrames ?? 0;
    const releaseOffset = this.#config.tickDurationMillis * this.#lockTicksPerDay * lockReleaseCosignDeadlineFrames;
    const expirationDateMillis = (expirationBlock - bitcoinBlockHeight) * BITCOIN_BLOCK_MILLIS;
    return Date.now() + expirationDateMillis - releaseOffset;
  }

  verifyExpirationTime(lock: IBitcoinLockRecord) {
    if (!this.#config) {
      throw new Error('Bitcoin lock configuration is not loaded for verify time.');
    }
    const expirationHeight = this.#config.pendingConfirmationExpirationBlocks + lock.lockDetails.createdAtHeight;

    if (expirationHeight <= this.bitcoinBlockHeight) {
      return Date.now() - 1; // Already expired
    }
    return Date.now() + (expirationHeight - this.bitcoinBlockHeight) * BITCOIN_BLOCK_MILLIS;
  }

  confirmAddress(lock: IBitcoinLockRecord) {
    const cosignScript = new CosignScript(lock.lockDetails, this.bitcoinNetwork);
    const pubkey = cosignScript.calculateScriptPubkey();
    if (lock.lockDetails.p2wshScriptHashHex !== pubkey) {
      throw new Error(`Lock with ID ${lock.utxoId} has an invalid address.`);
    }
  }

  async load(): Promise<void> {
    if (this.#waitForLoad) return this.#waitForLoad.promise;
    this.#waitForLoad = createDeferred<void>();
    try {
      const table = await this.getTable();
      const locks = await table.fetchAll();
      for (const lock of locks) {
        this.locksById[lock.utxoId] = lock;
      }
      this.#bitcoinLocksApi ??= new BitcoinLocks(Promise.resolve(await getMainchainClient(true)));
      this.#config ??= await this.#bitcoinLocksApi.getConfig();
      const client = await getMainchainClient(false);
      this.#lockTicksPerDay = client.consts.bitcoinLocks.argonTicksPerDay.toNumber();
      this.data.bitcoinNetwork = getBitcoinNetworkFromApi(this.#config.bitcoinNetwork);

      const header = await client.rpc.chain.getHeader();
      await this.check(header);
      this.#waitForLoad.resolve();
    } catch (error) {
      console.error('Error loading BitcoinLocksStore:', error);
      this.#waitForLoad.reject(error);
    }
    return this.#waitForLoad.promise;
  }

  async subscribe() {
    const client = await getMainchainClient(false);
    this.#subscription = await client.rpc.chain.subscribeNewHeads(h => this.check(h));
  }

  unsubscribe() {
    this.#subscription?.();
    this.#subscription = undefined;
  }

  async updateVaultSignature(lock: IBitcoinLockRecord): Promise<void> {
    const signature = await this.#bitcoinLocksApi.findVaultCosignSignature(lock.utxoId);

    if (signature) {
      const table = await this.getTable();
      await table.recordCosigned(lock, signature.signature, signature.blockHeight);
    }
  }

  async check(header: Header): Promise<void> {
    this.data.latestBlockHeight = header.number.toNumber();
    const locks = this.data.locksById;
    const table = await this.getTable();
    const client = await getMainchainClient(false);
    this.data.bitcoinBlockHeight = await client.query.bitcoinUtxos
      .confirmedBitcoinBlockTip()
      .then(x => x.value?.blockHeight.toNumber() ?? 0);
    for (const lock of Object.values(locks)) {
      if (lock.status === 'minted' || lock.status === 'initialized' || lock.status === 'pendingMint') {
        await this.updateTxid(lock);
      }

      if (lock.status === 'releaseRequested') {
        await this.updateVaultSignature(lock);
      }

      if (lock.status === 'pendingMint') {
        await this.updateTxid(lock);
        const chainPending = await this.#bitcoinLocksApi.findPendingMints(lock.utxoId);
        const localPending = lock.ratchets.reduce((sum, ratchet) => sum + ratchet.mintPending, 0n);
        const chainStillPending = chainPending.reduce((sum, x) => sum + x, 0n);
        if (chainStillPending === 0n) {
          lock.status = 'minted';
          for (const ratchet of lock.ratchets) {
            ratchet.mintPending = 0n;
          }
        } else {
          let amountFulfilled = localPending - chainStillPending;
          // account for the pending amount by allocating to the last entrants in the ratchet list
          for (const ratchet of lock.ratchets) {
            if (amountFulfilled === 0n) break;
            if (ratchet.mintPending > 0) {
              if (amountFulfilled >= ratchet.mintPending) {
                amountFulfilled -= ratchet.mintPending;
                ratchet.mintPending = 0n;
              } else {
                ratchet.mintPending -= amountFulfilled;
                amountFulfilled = 0n;
              }
            }
          }
        }

        await table.saveRatchetUpdates(lock);
      }
    }
  }

  async getNextUtxoPubkey(args: { vault: Vault; bip39Seed: Uint8Array }) {
    const { vault, bip39Seed } = args;
    const table = await this.getTable();

    // get bitcoin xpriv to generate the pubkey
    const nextIndex = await table.getNextVaultHdKeyIndex(vault.vaultId);
    const hdPath = `m/1018'/0'/${vault.vaultId}'/0/${nextIndex}`;
    const ownerBitcoinXpriv = getChildXpriv(bip39Seed, hdPath, this.bitcoinNetwork);
    const ownerBitcoinPubkey = getCompressedPubkey(ownerBitcoinXpriv.publicKey!);

    return { ownerBitcoinPubkey, hdPath };
  }

  async createInitializeTx(args: {
    vault: Vault;
    bip39Seed: Uint8Array;
    argonKeyring: KeyringPair;
    microgonLiquidity: bigint;
    maxMicrogonSpend?: bigint;
    addingVaultSpace?: bigint;
    tip?: bigint;
    txProgressCallback?: ITxProgressCallback;
  }) {
    const { ownerBitcoinPubkey, hdPath } = await this.getNextUtxoPubkey(args);
    const { vault, argonKeyring, maxMicrogonSpend, tip = 0n, addingVaultSpace = 0n } = args;

    const client = await getMainchainClient(false);

    const minimumSatoshis = await client.query.bitcoinLocks.minimumSatoshis().then(x => x.toBigInt());
    let microgonLiquidity = args.microgonLiquidity;
    const availableBtcSpace = vault.availableBitcoinSpace() + addingVaultSpace;
    if (availableBtcSpace < microgonLiquidity) {
      console.info('Vault liquidity is less than requested microgon liquidity, using vault available space instead.', {
        availableBtcSpace,
        requestedLiquidity: microgonLiquidity,
      });
      microgonLiquidity = availableBtcSpace;
    }
    let satoshis = await this.#bitcoinLocksApi.requiredSatoshisForArgonLiquidity(microgonLiquidity);
    while (satoshis >= minimumSatoshis) {
      try {
        const { txFee } = await this.#bitcoinLocksApi.createInitializeLockTx({
          vault,
          ownerBitcoinPubkey,
          argonKeyring,
          satoshis,
          tip,
        });

        if (maxMicrogonSpend === undefined || maxMicrogonSpend >= txFee) {
          break;
        }
      } catch (e) {}
      console.log(`Failed to create affordable bitcoin lock with ${satoshis} satoshis, trying with less...`);
      // If the transaction creation fails, reduce the satoshis by 10 and try again
      satoshis -= 10n;
    }
    if (satoshis < minimumSatoshis) {
      throw new Error(`Unable to create a bitcoin lock with the given liquidity: ${microgonLiquidity}`);
    }
    const { tx, securityFee } = await this.#bitcoinLocksApi.createInitializeLockTx({
      ...args,
      ownerBitcoinPubkey,
      satoshis,
    });

    return { hdPath, tx, ownerBitcoinPubkey, satoshis, securityFee };
  }

  public async saveBitcoinLock(args: {
    vaultId: number;
    hdPath: string;
    satoshis: bigint;
    txResult: TxResult;
    securityFee: bigint;
  }): Promise<IBitcoinLockRecord> {
    const { txResult, vaultId, hdPath, satoshis, securityFee } = args;

    const { lock: utxo, createdAtHeight } = await this.#bitcoinLocksApi.getBitcoinLockFromTxResult(txResult);

    const table = await this.getTable();

    const record = await table.insert({
      utxoId: utxo.utxoId,
      status: 'initialized',
      satoshis,
      ratchets: [
        {
          mintAmount: utxo.lockPrice,
          mintPending: utxo.lockPrice,
          blockHeight: createdAtHeight,
          burned: 0n,
          securityFee,
          txFee: txResult.finalFee ?? 0n,
          bitcoinBlockHeight: utxo.createdAtHeight,
        },
      ],
      lockPrice: utxo.lockPrice,
      cosignVersion: 'v1',
      lockDetails: utxo,
      network: this.#config.bitcoinNetwork.toString(),
      hdPath,
      vaultId: vaultId,
    });
    this.locksById[record.utxoId] = record;
    return record;
  }

  async calculateBitcoinNetworkFee(
    lock: IBitcoinLockRecord,
    feeRatePerSatVb: bigint,
    toScriptPubkey: string,
  ): Promise<bigint> {
    const cosignScript = new CosignScript(lock.lockDetails, this.bitcoinNetwork);
    toScriptPubkey = addressBytesHex(toScriptPubkey, this.bitcoinNetwork);
    console.log('Calculating fee for lock', {
      utxoId: lock.utxoId,
      feeRatePerSatVb: feeRatePerSatVb.toString(),
      toScriptPubkey,
    });
    return cosignScript.calculateFee(feeRatePerSatVb, toScriptPubkey);
  }

  fundingPsbt(lock: IBitcoinLockRecord): Uint8Array {
    if (lock.status !== 'initialized') {
      throw new Error(`Lock with ID ${lock.utxoId} is not in the initialized state.`);
    }
    return new CosignScript(lock.lockDetails, this.bitcoinNetwork).getFundingPsbt();
  }

  async requestRelease(args: {
    lock: IBitcoinLockRecord;
    bitcoinNetworkFee: bigint;
    toScriptPubkey: string;
    argonKeyring: KeyringPair;
    tip?: bigint;
    txProgressCallback?: ITxProgressCallback;
  }): Promise<void> {
    const { lock, bitcoinNetworkFee, toScriptPubkey, argonKeyring, tip = 0n, txProgressCallback } = args;
    const release = await this.#bitcoinLocksApi.requestRelease({
      lock: lock.lockDetails,
      releaseRequest: {
        toScriptPubkey: addressBytesHex(toScriptPubkey, this.bitcoinNetwork),
        bitcoinNetworkFee,
      },
      argonKeyring,
      tip,
      txProgressCallback,
    });

    const table = await this.getTable();
    await table.requestedRelease(lock, release.blockHeight, toScriptPubkey, bitcoinNetworkFee);
  }

  async ratchet(lock: IBitcoinLockRecord, argonKeyring: KeyringPair, tip = 0n) {
    const table = await this.getTable();
    if (lock.status !== 'minted' && lock.status !== 'pendingMint') {
      throw new Error(`Lock with ID ${lock.utxoId} is not verified.`);
    }

    const vaults = useVaults();

    const result = await this.#bitcoinLocksApi.ratchet({
      lock: lock.lockDetails,
      argonKeyring,
      tip,
      vault: vaults.vaultsById[lock.vaultId],
    });

    const { burned, securityFee, bitcoinBlockHeight, blockHeight, newLockPrice, pendingMint, txFee } = result;

    lock.ratchets.push({
      mintAmount: pendingMint,
      mintPending: pendingMint,
      txFee,
      burned,
      securityFee,
      blockHeight,
      bitcoinBlockHeight,
    });
    lock.lockPrice = newLockPrice;
    lock.lockDetails.lockPrice = newLockPrice;
    lock.status = 'pendingMint';

    await table.saveNewRatchet(lock);
  }

  /**
   * Cosigns the transaction.
   *
   * @param lock
   * @param bip39Seed
   * @param addTx
   */
  async cosignAndGenerateTxBytes(
    lock: IBitcoinLockRecord,
    bip39Seed: Uint8Array,
    addTx?: string,
  ): Promise<{
    txid: string;
    bytes: Uint8Array;
  }> {
    if (lock.cosignVersion !== 'v1') {
      throw new Error(`Unsupported cosign version: ${lock.cosignVersion}`);
    }
    if (!lock.releaseCosignSignature) {
      throw new Error(`Lock with ID ${lock.utxoId} has not been cosigned yet.`);
    }
    if (!lock.txid) {
      await this.updateTxid(lock);
      if (!lock.txid) {
        throw new Error(`Utxo with ID ${lock.utxoId} not found.`);
      }
    }
    const cosignature = await this.#bitcoinLocksApi.findVaultCosignSignature(lock.utxoId);
    if (!cosignature) {
      throw new Error(`Lock with ID ${lock.utxoId} has not been cosigned yet.`);
    }

    if (!lock.releaseToDestinationAddress) {
      // const clientAt = await getMainchainClientAt(cosignature.blockHeight, true);
      const signatureDetails = await this.#bitcoinLocksApi.getReleaseRequest(lock.utxoId, cosignature.blockHeight);
      if (!signatureDetails) {
        throw new Error(`Release request for lock with ID ${lock.utxoId} not found.`);
      }
      lock.releaseToDestinationAddress = signatureDetails.toScriptPubkey;
      lock.releaseBitcoinNetworkFee = signatureDetails.bitcoinNetworkFee;
      const table = await this.getTable();
      await table.requestedRelease(
        lock,
        cosignature.blockHeight,
        lock.releaseToDestinationAddress,
        lock.releaseBitcoinNetworkFee,
      );
    }
    const cosign = new CosignScript(lock.lockDetails, this.bitcoinNetwork);
    const tx = cosign.cosignAndGenerateTx({
      releaseRequest: {
        toScriptPubkey: lock.releaseToDestinationAddress,
        bitcoinNetworkFee: lock.releaseBitcoinNetworkFee!,
      },
      vaultCosignature: cosignature.signature,
      utxoRef: { txid: lock.txid, vout: lock.vout! },
      ownerXpriv: getChildXpriv(bip39Seed, lock.hdPath, this.bitcoinNetwork),
      addTx,
    });
    if (!tx) {
      throw new Error(`Failed to cosign and generate transaction for lock with ID ${lock.utxoId}`);
    }
    if (!tx.isFinal) {
      throw new Error(`Transaction for lock with ID ${lock.utxoId} is not finalized.`);
    }
    return { bytes: tx.toBytes(true, true), txid: tx.id };
  }

  formatP2swhAddress(scriptHex: string): string {
    try {
      return p2wshScriptHexToAddress(scriptHex, this.bitcoinNetwork);
    } catch (e: any) {
      throw new Error(`Invalid address: ${scriptHex}. Ensure it is a valid hex address. ${e.message}`);
    }
  }

  getMempoolApi() {
    let network = 'mainnet';
    if (this.bitcoinNetwork === BitcoinNetwork.Testnet) {
      network = 'testnet';
    } else if (this.bitcoinNetwork === BitcoinNetwork.Signet) {
      network = 'signet';
    } else if (this.bitcoinNetwork === BitcoinNetwork.Regtest) {
      network = 'regtest';
    }

    return `${ESPLORA_HOST ?? 'https://mempool.space/api'}/`;
  }

  async checkTxidStatus(
    lock: IBitcoinLockRecord,
    txid: string,
  ): Promise<{
    isConfirmed: boolean;
    blockHeight: number;
  }> {
    const api = this.getMempoolApi();
    const response = await fetch(`${api}tx/${txid}/status`);
    const status = (await response.json()) as TxStatus;
    if (!status) {
      throw new Error(`Transaction with ID ${txid} not found.`);
    }

    if (status.confirmed) {
      lock.status = 'released';
      lock.releasedAtHeight = status.block_height;
      lock.releasedTxId = txid;

      const table = await this.getTable();
      await table.recordReleaseTxid(lock);
    }

    return {
      blockHeight: status.block_height,
      isConfirmed: status.confirmed,
    };
  }

  async checkFundingStatus(lock: IBitcoinLockRecord): Promise<
    | {
        isConfirmed: boolean;
        confirmations: number;
        satoshis: bigint;
        blockHeight: number;
        argonBitcoinHeight: number;
        bitcoinBlockTimeMillis: number;
      }
    | undefined
  > {
    const baseUrl = `${ESPLORA_HOST ?? 'https://mempool.space/api'}/`;

    const payToScriptAddress = lock.lockDetails.p2wshScriptHashHex;
    const response = await fetch(`${baseUrl}address/${this.formatP2swhAddress(payToScriptAddress)}/utxo`);
    const txs = (await response.json()) as AddressTxsUtxo[];
    if (!txs.length) return undefined;
    const tx = txs[0]; // Get the most recent transaction
    const argonBitcoinHeight = this.bitcoinBlockHeight;
    const blockTipResponse = await fetch(`${baseUrl}blocks/tip/height`);
    const tip: number = await blockTipResponse.json();
    const status = tx.status;
    return {
      satoshis: BigInt(tx.value),
      blockHeight: status.block_height,
      isConfirmed: status.confirmed,
      confirmations: status.confirmed ? tip - status.block_height : 0,
      argonBitcoinHeight,
      bitcoinBlockTimeMillis: BITCOIN_BLOCK_MILLIS,
    };
  }

  static async getFeeRates() {
    const res = await fetch('https://mempool.space/api/v1/fees/recommended');
    const data = await res.json();
    return {
      fast: { feeRate: BigInt(data.fastestFee), estimatedMinutes: 10 } as IFeeRate,
      medium: { feeRate: BigInt(data.halfHourFee), estimatedMinutes: 30 } as IFeeRate,
      slow: { feeRate: BigInt(data.hourFee), estimatedMinutes: 60 } as IFeeRate,
    };
  }

  private async updateTxid(lock: IBitcoinLockRecord): Promise<void> {
    if (lock.txid) return;

    const latest = await this.#bitcoinLocksApi.getBitcoinLock(lock.utxoId);
    if (!latest?.isVerified) {
      return;
    }
    const utxo = await this.#bitcoinLocksApi.getBitcoinLock(lock.utxoId);
    const utxoRef = await this.#bitcoinLocksApi.getUtxoRef(lock.utxoId);
    if (!utxoRef || !utxo) {
      console.warn(`Utxo with ID ${lock.utxoId} not found`);
      return;
    }
    if (utxo.isVerified) {
      lock.status = 'pendingMint';

      lock.txid = utxoRef.txid;
      lock.vout = utxoRef.vout;
    } else if (utxo.isRejectedNeedsRelease) {
      lock.status = 'verificationFailed';
    }
    const table = await this.getTable();
    await table.recordVerifiedStatus(lock);
  }

  private async getTable(): Promise<BitcoinLocksTable> {
    const db = await this.dbPromise;
    return db.bitcoinLocksTable;
  }
}

export interface IFeeRate {
  feeRate: bigint; // sat/vB
  estimatedMinutes: number; // estimated time in minutes for the transaction to be included
}
