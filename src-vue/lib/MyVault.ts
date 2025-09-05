import {
  BitcoinLocks,
  ITxProgressCallback,
  KeyringPair,
  PalletVaultsVaultFrameRevenue,
  toFixedNumber,
  TxResult,
  TxSubmitter,
  u64,
  u8aToHex,
  Vault,
  Vec,
} from '@argonprotocol/mainchain';
import { BitcoinNetwork, CosignScript, getBitcoinNetworkFromApi, getChildXpriv, HDKey } from '@argonprotocol/bitcoin';
import { Db } from './Db.ts';
import { getMining, getMainchainClient } from '../stores/mainchain.ts';
import { createDeferred, IDeferred } from './Utils.ts';
import { IVaultRecord, VaultsTable } from './db/VaultsTable.ts';
import { IVaultingRules } from '../interfaces/IVaultingRules.ts';

import BigNumber from 'bignumber.js';
import { Vaults } from './Vaults.ts';
import { IVaultStats } from '../interfaces/IVaultStats.ts';
import { toRaw } from 'vue';
import BitcoinLocksStore from './BitcoinLocksStore.ts';
import { MiningFrames } from '@argonprotocol/commander-core';

export class MyVault {
  public data: {
    createdVault: Vault | null;
    creatingVaultPromise?: Promise<{ vault: Vault; txResult: TxResult }>;
    metadata: IVaultRecord | null;
    stats: IVaultStats | null;
    ownTreasuryPoolCapitalDeployed: bigint;
    pendingCollectRevenue: bigint;
    pendingCosignUtxoIds: Set<number>;
    nextCollectDueDate: number;
  };

  public get createdVault(): Vault | null {
    return this.data.createdVault;
  }

  public get metadata(): IVaultRecord | null {
    return this.data.metadata;
  }

  public get tickDuration(): number {
    return this.vaults?.tickDuration ?? 0;
  }

  #bitcoinNetwork?: BitcoinNetwork;
  #waitForLoad?: IDeferred;
  #table?: VaultsTable;
  #subscriptions: VoidFunction[] = [];
  #bitcoinLocks?: BitcoinLocks;
  #configs?: {
    timeToCollectFrames: number;
  };

  constructor(
    readonly dbPromise: Promise<Db>,
    readonly vaults: Vaults,
  ) {
    this.data = {
      createdVault: null,
      metadata: null,
      stats: null,
      ownTreasuryPoolCapitalDeployed: 0n,
      pendingCollectRevenue: 0n,
      pendingCosignUtxoIds: new Set(),
      nextCollectDueDate: 0,
    };
    this.vaults = vaults;
  }

  public async getBitcoinNetwork(): Promise<BitcoinNetwork> {
    if (this.#bitcoinNetwork) {
      return this.#bitcoinNetwork;
    }
    const client = await getMainchainClient(false);
    const bitcoinNetwork = await client.query.bitcoinUtxos.bitcoinNetwork();
    this.#bitcoinNetwork = getBitcoinNetworkFromApi(bitcoinNetwork);
    return this.#bitcoinNetwork;
  }

  public async getVaultXpub(bip39Seed: Uint8Array, masterXpubPath?: string): Promise<HDKey> {
    masterXpubPath ??= this.metadata!.hdPath;
    if (!masterXpubPath) {
      throw new Error('No master xpub path defined in metadata');
    }
    const network = await this.getBitcoinNetwork();
    return getChildXpriv(bip39Seed, masterXpubPath, network);
  }

  public async load(reload = false): Promise<void> {
    if (this.#waitForLoad && !reload) return this.#waitForLoad.promise;

    this.#waitForLoad ??= createDeferred();
    try {
      console.log('Loading MyVault...');
      await this.vaults.load(reload);

      void this.vaults.refreshRevenue().then(() => {
        const vaultId = this.metadata?.id;
        if (vaultId) {
          this.data.stats = this.vaults.stats?.vaultsById[vaultId] ?? null;
        }
      });
      const table = await this.getTable();
      const client = await getMainchainClient(true);
      this.#bitcoinLocks ??= new BitcoinLocks(Promise.resolve(client));
      this.data.metadata = (await table.get()) ?? null;
      // prefetch the config
      const timeToCollectFrames = client.consts.vaults.revenueCollectionExpirationFrames.toNumber();
      this.#configs = {
        timeToCollectFrames,
      };
      const vaultId = this.data.metadata?.id;
      if (vaultId) {
        this.data.createdVault = this.vaults.vaultsById[vaultId];
        this.data.stats = this.vaults.stats?.vaultsById[vaultId] ?? null;
        console.log('Stats on load:', toRaw(this.data.stats));
      }

      this.#waitForLoad.resolve();
    } catch (error) {
      this.#waitForLoad.reject(error as Error);
    }
    return this.#waitForLoad.promise;
  }

  public async subscribe() {
    if (this.#subscriptions.length) return;
    if (!this.createdVault) {
      throw new Error('No vault created to subscribe to');
    }
    const vaultId = this.createdVault.vaultId;
    const client = await getMainchainClient(false);
    const sub = await client.query.vaults.vaultsById(vaultId, async vault => {
      if (vault.isNone) return;
      this.createdVault?.load(vault.unwrap());
      await this.updateRevenue();
    });

    const sub2 = await client.query.vaults.revenuePerFrameByVault(vaultId, async x => {
      await this.updateRevenue(x);
    });

    const sub3 = await client.query.vaults.pendingCosignByVaultId(vaultId, x => this.recordPendingCosignUtxos(x));
    const sub4 = await client.query.vaults.lastCollectFrameByVaultId(vaultId, x =>
      this.updateCollectDueDate(x.isSome ? x.unwrap().toNumber() : undefined),
    );

    await this.updateCollectDueDate();

    this.#subscriptions.push(sub, sub2, sub3, sub4);
  }

  private async updateCollectDueDate(lastCollectFrameId?: number) {
    lastCollectFrameId ??= await getMining().getCurrentFrameId();

    const nextCollectDue = lastCollectFrameId + this.#configs!.timeToCollectFrames;
    this.data.nextCollectDueDate = MiningFrames.frameToDateRange(nextCollectDue)[0].getTime();
  }

  private async recordPendingCosignUtxos(rawUtxoIds: Iterable<u64>) {
    this.data.pendingCosignUtxoIds.clear();
    for (const utxoId of rawUtxoIds) {
      this.data.pendingCosignUtxoIds.add(utxoId.toNumber());
    }
  }

  public async cosignRelease(args: {
    argonKeyring: KeyringPair;
    vaultXpriv: HDKey;
    utxoId: number;
    bitcoinNetworkFee: bigint;
    toScriptPubkey: string;
    progressCallback?: ITxProgressCallback;
  }): Promise<{ blockNumber: number; blockHash: Uint8Array; txResult: TxResult } | undefined> {
    const { argonKeyring, vaultXpriv, utxoId, progressCallback, bitcoinNetworkFee, toScriptPubkey } = args;

    const lock = await this.#bitcoinLocks!.getBitcoinLock(utxoId);
    if (!lock) {
      console.warn('No lock found for utxoId:', utxoId);
      return;
    }

    const releaseRequest = await this.#bitcoinLocks!.getReleaseRequest(utxoId);
    if (!releaseRequest) {
      console.warn('No release request found for utxoId:', utxoId);
      return;
    }
    const utxoRef = await this.#bitcoinLocks!.getUtxoRef(utxoId);
    if (!utxoRef) {
      console.warn('No UTXO reference found for utxoId:', utxoId);
      return;
    }

    const cosign = new CosignScript(lock, await this.getBitcoinNetwork());
    const psbt = cosign.getCosignPsbt({
      releaseRequest: {
        bitcoinNetworkFee,
        toScriptPubkey,
      },
      utxoRef,
    });
    const signedPsbt = cosign.vaultCosignPsbt(psbt, lock, vaultXpriv);
    const vaultSignature = signedPsbt.getInput(0).partialSig?.[0]?.[1];
    if (!vaultSignature) {
      throw new Error('Failed to get vault signature from PSBT for utxoId: ' + utxoId);
    }

    const txResult = await this.#bitcoinLocks!.submitVaultSignature({
      utxoId,
      vaultSignature,
      argonKeyring,
    });
    txResult.txProgressCallback = progressCallback;
    const blockHash = await txResult.inBlockPromise;
    txResult.txProgressCallback = undefined;
    const client = await getMainchainClient(false);
    const api = await client.at(blockHash);
    const txResultBlockNumber = await api.query.system.number();

    console.log(`Cosigned and submitted transaction for utxoId ${utxoId} at ${u8aToHex(txResult.includedInBlock)}`);
    return { blockNumber: txResultBlockNumber.toNumber(), blockHash, txResult };
  }

  public async collect(
    args: { argonKeyring: KeyringPair; xprivSeed: Uint8Array },
    progressCallback?: (cosignProgress: number, activeTransactionProgress: number, steps: number) => void,
  ) {
    if (!this.createdVault) {
      throw new Error('No vault created to collect revenue');
    }
    if (!this.metadata) {
      throw new Error('No metadata available to collect revenue');
    }
    const { argonKeyring, xprivSeed } = args;
    const toCollect = this.data.pendingCosignUtxoIds;

    const steps = toCollect.size + 1; // +1 for the final collect transaction
    const vaultXpriv = await this.getVaultXpub(xprivSeed, this.metadata.hdPath);
    let completed = 0;
    const client = await getMainchainClient(false);
    for (const utxoId of toCollect) {
      const pendingReleaseRaw = await client.query.bitcoinLocks.lockReleaseRequestsByUtxoId(utxoId);
      if (pendingReleaseRaw.isNone) {
        continue;
      }
      const pendingRelease = pendingReleaseRaw.unwrap();

      await this.cosignRelease({
        argonKeyring,
        vaultXpriv,
        utxoId,
        bitcoinNetworkFee: pendingRelease.bitcoinNetworkFee.toBigInt(),
        toScriptPubkey: pendingRelease.toScriptPubkey.toHex(),
        progressCallback(progressPct) {
          if (progressCallback) {
            progressCallback((completed * 100) / steps, progressPct, steps);
          }
        },
      });
      completed++;
    }
    // now we can collect!
    const tx = new TxSubmitter(client, client.tx.vaults.collect(this.createdVault.vaultId), argonKeyring);
    const txResult = await tx.submit({
      waitForBlock: true,
      txProgressCallback(progressPct) {
        if (progressCallback) {
          progressCallback((completed * 100) / steps, progressPct, steps);
        }
      },
    });
    txResult.txProgressCallback = undefined;
    completed++;
    if (progressCallback) {
      progressCallback(100, 100, steps);
    }
    // TODO: redistribute to the treasury pool and vaults
  }

  public async create(args: {
    argonKeyring: KeyringPair;
    xprivSeed: Uint8Array;
    rules: IVaultingRules;
    masterXpubPath: string;
    progressCallback?: ITxProgressCallback;
  }) {
    if (this.data.creatingVaultPromise) {
      return this.data.creatingVaultPromise;
    }

    console.log('creating a vault with address', args.argonKeyring.address);

    const createVaultDeferred = createDeferred<{ vault: Vault; txResult: TxResult }>();
    this.data.creatingVaultPromise = createVaultDeferred.promise;
    try {
      const { argonKeyring, xprivSeed, masterXpubPath, rules } = args;

      const vaultXpriv = await this.getVaultXpub(xprivSeed, masterXpubPath);
      const masterXpub = vaultXpriv.publicExtendedKey;
      const client = await getMainchainClient(false);

      const { vault, txResult } = await Vault.create(
        client,
        argonKeyring,
        {
          securitizationRatio: rules.securitizationRatio,
          securitization: 1,
          annualPercentRate: rules.btcPctFee / 100,
          baseFee: rules.btcFlatFee,
          bitcoinXpub: masterXpub,
          liquidityPoolProfitSharing: rules.profitSharingPct / 100,
          txProgressCallback: args.progressCallback,
        },
        { tickDurationMillis: this.vaults.tickDuration },
      );
      const table = await this.getTable();
      const api = await client.at(txResult.includedInBlock!);
      const blockNumber = await api.query.system.number();
      this.data.metadata = await table.insert(
        vault.vaultId,
        masterXpubPath,
        blockNumber.toNumber(),
        txResult.finalFee ?? 0n,
      );
      this.data.createdVault = vault;
      this.vaults.vaultsById[vault.vaultId] = vault;
      createVaultDeferred.resolve({ vault, txResult });
    } catch (error) {
      console.error('Error creating vault:', error);
      createVaultDeferred.reject(error as Error);
    }
    this.data.creatingVaultPromise = undefined;
    return createVaultDeferred.promise;
  }

  public async updateRevenue(frameRevenues?: Vec<PalletVaultsVaultFrameRevenue>): Promise<void> {
    if (!this.createdVault) {
      throw new Error('No vault created to update revenue');
    }
    const client = await getMainchainClient(false);
    const vaultId = this.createdVault.vaultId;
    frameRevenues ??= await client.query.vaults.revenuePerFrameByVault(vaultId);
    this.vaults.vaultsById[vaultId] = this.createdVault;

    await this.vaults.updateVaultRevenue(vaultId, frameRevenues);
    this.data.ownTreasuryPoolCapitalDeployed = 0n;
    this.data.pendingCollectRevenue = 0n;
    for (const frameRevenue of frameRevenues) {
      this.data.ownTreasuryPoolCapitalDeployed += frameRevenue.liquidityPoolVaultCapital.toBigInt();
      this.data.pendingCollectRevenue += frameRevenue.uncollectedRevenue.toBigInt();
    }
    const data = this.vaults.stats?.vaultsById?.[vaultId];
    if (data) {
      this.data.stats = { ...data };
    }
  }

  public unsubscribe() {
    for (const sub of this.#subscriptions) {
      sub();
    }
    this.#subscriptions.length = 0;
  }

  public async activeMicrogonsForTreasuryPool(): Promise<{ maxAmountPerFrame?: bigint; active: bigint }> {
    if (!this.createdVault) {
      throw new Error('No vault created to get active treasury pool funds');
    }
    const client = await getMainchainClient(false);
    const vaultId = this.createdVault.vaultId;
    const prebondedToPool = await client.query.liquidityPools.prebondedByVaultId(vaultId);
    const activePoolFunds =
      this.data.stats?.changesByFrame
        .slice(0, 10)
        .reduce((total, change) => total + change.treasuryPool.vaultCapital, 0n) ?? 0n;

    const maxAmountPerFrame = prebondedToPool.isSome
      ? prebondedToPool.unwrap().maxAmountPerFrame.toBigInt()
      : undefined;
    return { active: activePoolFunds, maxAmountPerFrame };
  }

  public async saveVaultRules(args: {
    argonKeyring: KeyringPair;
    rules: IVaultingRules;
    bip39Seed: Uint8Array;
    bitcoinLocksStore: BitcoinLocksStore;
    txProgressCallback: ITxProgressCallback;
    tip?: bigint;
  }) {
    const vaultId = this.createdVault?.vaultId;
    if (!vaultId) {
      throw new Error('No vault created to prebond treasury pool');
    }
    const vault = this.createdVault;
    const { bip39Seed, bitcoinLocksStore, argonKeyring, rules, tip = 0n, txProgressCallback } = args;
    const client = await getMainchainClient(false);

    // need to leave enough for the BTC fees
    const { microgonsForTreasury, microgonsForSecuritization } = MyVault.getMicrogoonSplit(
      rules,
      this.metadata?.operationalFeeMicrogons ?? 0n,
    );

    const txs = [];
    const addedSecuritization = microgonsForSecuritization - vault.securitization;
    if (addedSecuritization > 0n) {
      const tx = client.tx.vaults.modifyFunding(
        vaultId,
        microgonsForSecuritization,
        toFixedNumber(rules.securitizationRatio, 18),
      );
      txs.push(tx);
    }
    const { maxAmountPerFrame, active } = await this.activeMicrogonsForTreasuryPool();
    let needsPrebondIncrease;
    if (maxAmountPerFrame !== undefined) {
      needsPrebondIncrease = maxAmountPerFrame < microgonsForTreasury / 10n;
    } else {
      needsPrebondIncrease = active < microgonsForTreasury;
    }
    if (needsPrebondIncrease) {
      const tx = client.tx.liquidityPools.vaultOperatorPrebond(vaultId, microgonsForTreasury / 10n);
      txs.push(tx);
    }
    let bitcoinArgs: { satoshis: bigint; hdPath: string; securityFee: bigint } | undefined;
    if (!this.metadata?.personalUtxoId && rules.personalBtcInMicrogons > 0n) {
      const { tx, satoshis, hdPath, securityFee } = await bitcoinLocksStore.createInitializeTx({
        argonKeyring,
        bip39Seed,
        vault,
        addingVaultSpace: BigInt(Number(addedSecuritization) / vault.securitizationRatio),
        microgonLiquidity: microgonsForTreasury,
        tip,
      });
      bitcoinArgs = { satoshis, hdPath, securityFee };
      txs.push(tx);
    }

    if (!txs.length) {
      return undefined;
    }
    txProgressCallback(5);
    const table = await this.getTable();

    const txSubmitter = new TxSubmitter(client, client.tx.utility.batchAll(txs), argonKeyring);
    const txResult = await txSubmitter.submit({ tip, txProgressCallback });
    const blockHash = await txResult.inBlockPromise;
    const api = await client.at(blockHash);
    const tick = await api.query.ticks.currentTick();

    console.log('Saving vault updates', {
      microgonsForTreasury,
      microgonsForSecuritization,
      tip,
      meta: this.metadata,
    });
    this.metadata!.prebondedMicrogons = microgonsForTreasury;
    this.metadata!.prebondedMicrogonsAtTick = tick.toNumber();
    this.metadata!.operationalFeeMicrogons ??= 0n;
    this.metadata!.operationalFeeMicrogons += txResult.finalFee ?? 0n;
    await table.save(this.metadata!);
    if (bitcoinArgs) {
      const record = await bitcoinLocksStore.saveBitcoinLock({ vaultId, txResult, ...bitcoinArgs });
      this.metadata!.personalUtxoId = record.utxoId;
      await table.save(this.metadata!);
    }
    return { txResult };
  }

  private async getTable(): Promise<VaultsTable> {
    this.#table ??= await this.dbPromise.then(x => x.vaultsTable);
    return this.#table;
  }

  public static getMicrogoonSplit(rules: IVaultingRules, existingFees: bigint = 0n) {
    const estimatedOperationalFees = existingFees + 75_000n;
    const microgonsForVaulting = rules.baseMicrogonCommitment - estimatedOperationalFees;
    const microgonsForSecuritization = BigInt(
      BigNumber(rules.capitalForSecuritizationPct).div(100).times(microgonsForVaulting).toFixed(),
    );

    const microgonsForTreasury = BigInt(
      BigNumber(rules.capitalForTreasuryPct).div(100).times(microgonsForVaulting).toFixed(),
    );
    return {
      microgonsForVaulting,
      microgonsForSecuritization,
      microgonsForTreasury,
      estimatedOperationalFees,
    };
  }
}
