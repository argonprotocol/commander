import {
  BitcoinLocks,
  BTreeMap,
  ITxProgressCallback,
  KeyringPair,
  type PalletBitcoinLocksLockReleaseRequest,
  TxResult,
  TxSubmitter,
  u64,
  u8aToHex,
  Vault,
} from '@argonprotocol/mainchain';
import { BitcoinNetwork, CosignScript, getBitcoinNetworkFromApi, getChildXpriv, HDKey } from '@argonprotocol/bitcoin';
import { Db } from './Db.ts';
import { getMainchainClient } from '../stores/mainchain.ts';
import { deferred, IDeferred } from './Utils.ts';
import { IVaultRecord, VaultsTable } from './db/VaultsTable.ts';
import IVaultingRules from '../interfaces/IVaultingRules.ts';
import BigNumber from 'bignumber.js';
import { Vaults } from './Vaults.ts';
import { IVaultStats } from '../interfaces/IVaultStats.ts';
import { Mainchain } from '@argonprotocol/commander-calculator';
import { toRaw } from 'vue';

export interface IBitcoinUtxoPendingRelease {
  bitcoinNetworkFee: bigint;
  cosignDueBlock: number;
  toScriptPubkey: string;
}

export class MyVault {
  public data: {
    createdVault: Vault | null;
    creatingVaultPromise?: IDeferred<{ vault: Vault; txResult: TxResult }>;
    metadata: IVaultRecord | null;
    stats: IVaultStats | null;
    ownLiquidityPoolCapitalDeployed: bigint;
    pendingCollectRevenue: bigint;
    pendingCosignUtxoIds: Map<number, IBitcoinUtxoPendingRelease>;
    nextCollectDueTick: number;
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

  constructor(
    readonly dbPromise: Promise<Db>,
    readonly vaults: Vaults,
  ) {
    this.data = {
      createdVault: null,
      metadata: null,
      stats: null,
      ownLiquidityPoolCapitalDeployed: 0n,
      pendingCollectRevenue: 0n,
      pendingCosignUtxoIds: new Map(),
      nextCollectDueTick: 0,
    };
    this.vaults = vaults;
  }

  public async getBitcoinNetwork(): Promise<BitcoinNetwork> {
    if (this.#bitcoinNetwork) {
      return this.#bitcoinNetwork;
    }
    const client = await getMainchainClient();
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
    if (this.#waitForLoad && !reload) return this.#waitForLoad;

    this.#waitForLoad ??= deferred();
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
      const client = await getMainchainClient();
      this.#bitcoinLocks ??= new BitcoinLocks(Promise.resolve(client));
      this.data.metadata = (await table.get()) ?? null;
      if (this.metadata?.id) {
        this.data.createdVault = this.vaults.vaultsById[this.metadata.id];
        this.data.stats = this.vaults.stats?.vaultsById[this.metadata.id] ?? null;
        console.log('Stats on load:', toRaw(this.data.stats));
        const poolCapital = await client.query.liquidityPools.vaultPoolsByFrame.entries();
        const vaultOperator = this.data.createdVault.operatorAccountId;
        for (const [_frameId, pools] of poolCapital) {
          const liquidityPoolFrame = Mainchain.translateFrameLiquidityPools(pools)[this.createdVault?.vaultId!];
          if (liquidityPoolFrame) {
            this.data.ownLiquidityPoolCapitalDeployed += liquidityPoolFrame.contributors[vaultOperator] ?? 0n;
          }
        }
        await client.query.bitcoinLocks.locksPendingReleaseByUtxoId().then(x => this.recordPendingCosignUtxos(x));
      }
      const currentTick = await client.query.ticks.currentTick().then(x => x.toNumber());

      // TODO: this is fully fake, so create a real one
      this.data.nextCollectDueTick = currentTick + 60 * 24 * 10; // 10 days in minutes
      this.#waitForLoad.resolve();
    } catch (error) {
      this.#waitForLoad.reject(error as Error);
    }
  }

  public async subscribe() {
    if (this.#subscriptions.length) return;
    if (!this.createdVault) {
      throw new Error('No vault created to subscribe to');
    }
    const vaultId = this.createdVault.vaultId;
    const client = await getMainchainClient();
    const sub = await client.query.vaults.vaultsById(vaultId, async vault => {
      if (vault.isNone) return;
      this.createdVault?.load(vault.unwrap());
      await this.updateRevenue();
    });

    const sub2 = await client.query.miningSlot.nextFrameId(async _nextFrame => {
      await this.updateRevenue();
    });

    const sub3 = await client.query.bitcoinLocks.locksPendingReleaseByUtxoId(x => this.recordPendingCosignUtxos(x));

    this.#subscriptions.push(sub, sub2, sub3);
  }

  private recordPendingCosignUtxos(pendingCosign: BTreeMap<u64, PalletBitcoinLocksLockReleaseRequest>) {
    for (const [utxoIdRaw, lock] of pendingCosign) {
      if (lock.vaultId.toNumber() === this.createdVault?.vaultId) {
        const utxoId = utxoIdRaw.toNumber();

        this.data.pendingCosignUtxoIds.set(utxoId, {
          bitcoinNetworkFee: lock.bitcoinNetworkFee.toBigInt(),
          cosignDueBlock: lock.cosignDueBlock.toNumber(),
          toScriptPubkey: lock.toScriptPubkey.toHex(),
        });
      }
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
    const client = await getMainchainClient();
    const api = await client.at(blockHash);
    const txResultBlockNumber = await api.query.system.number();

    console.log(`Cosigned and submitted transaction for utxoId ${utxoId} at ${u8aToHex(txResult.includedInBlock)}`);
    return { blockNumber: txResultBlockNumber.toNumber(), blockHash, txResult };
  }

  public async collect(
    args: { argonKeyring: KeyringPair; xprivSeed: Uint8Array },
    progressCallback?: (cosignProgress: number, cosignTxProgress: number, steps: number) => void,
  ) {
    if (!this.createdVault) {
      throw new Error('No vault created to collect revenue');
    }
    if (!this.metadata) {
      throw new Error('No metadata available to collect revenue');
    }
    const { argonKeyring, xprivSeed } = args;
    const toCollect = this.data.pendingCosignUtxoIds;

    const vaultXpriv = await this.getVaultXpub(xprivSeed, this.metadata.hdPath);
    let completed = 0;
    for (const [utxoId, pendingRelease] of toCollect) {
      await this.cosignRelease({
        argonKeyring,
        vaultXpriv,
        utxoId,
        bitcoinNetworkFee: pendingRelease.bitcoinNetworkFee,
        toScriptPubkey: pendingRelease.toScriptPubkey,
        progressCallback(progressPct) {
          if (progressCallback) {
            progressCallback((completed * 100) / toCollect.size, progressPct, toCollect.size);
          }
        },
      });
      completed++;
    }
    // now we can collect!
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

    const createVaultDeferred = deferred<{ vault: Vault; txResult: TxResult }>();
    this.data.creatingVaultPromise = createVaultDeferred;
    try {
      const { argonKeyring, xprivSeed, masterXpubPath, rules } = args;

      const { microgonsForSecuritization } = MyVault.getMicrogoonSplit(rules);
      const vaultXpriv = await this.getVaultXpub(xprivSeed, masterXpubPath);
      const masterXpub = vaultXpriv.publicExtendedKey;
      const client = await getMainchainClient();

      const { vault, txResult } = await Vault.create(
        client,
        argonKeyring,
        {
          securitizationRatio: rules.securitizationRatio,
          securitization: microgonsForSecuritization,
          annualPercentRate: rules.btcPctFee / 100,
          baseFee: rules.btcFlatFee,
          bitcoinXpub: masterXpub,
          liquidityPoolProfitSharing: rules.profitSharingPct / 100,
          doNotExceedBalance: microgonsForSecuritization,
          txProgressCallback: args.progressCallback,
        },
        { tickDurationMillis: this.vaults.tickDuration },
      );
      const table = await this.getTable();
      const api = await client.at(txResult.includedInBlock!);
      const blockNumber = await api.query.system.number();
      this.data.metadata = await table.insert(vault.vaultId, masterXpubPath, blockNumber.toNumber());
      this.data.createdVault = vault;
      this.vaults.vaultsById[vault.vaultId] = vault;
      createVaultDeferred.resolve({ vault, txResult });
    } catch (error) {
      console.error('Error creating vault:', error);
      createVaultDeferred.reject(error as Error);
    }
    this.data.creatingVaultPromise = undefined;
    return createVaultDeferred;
  }

  public async updateRevenue(): Promise<void> {
    if (!this.createdVault) {
      throw new Error('No vault created to update revenue');
    }
    const client = await getMainchainClient();
    const vaultId = this.createdVault.vaultId;
    const frameRevenueByVault = await client.query.vaults.perFrameFeeRevenueByVault(vaultId);
    const frameId = await client.query.miningSlot.nextFrameId().then(x => x.toNumber() - 1);
    const frameIds = [0, 1, 2].map(i => frameId - i);
    const liquidity = await client.query.liquidityPools.vaultPoolsByFrame.multi(frameIds);
    this.vaults.vaultsById[vaultId] = this.createdVault;

    for (let i = 0; i < frameIds.length; i++) {
      const loadFrameId = frameIds[i];
      const frameLiquidity = liquidity[i];
      const frameRevenue = frameRevenueByVault.find(x => x.frameId.toNumber() === loadFrameId);

      const liquidityPoolFrame = Mainchain.translateFrameLiquidityPools(frameLiquidity)[vaultId];
      await this.vaults.updateVaultRevenue({
        vaultId,
        frameId: loadFrameId,
        api: client,
        currentFrameId: frameId,
        frameRevenue,
        liquidityPoolFrame,
      });
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

  public async prebondLiquidityPool(args: { argonKeyring: KeyringPair; rules: IVaultingRules; tip?: bigint }) {
    const vaultId = this.createdVault?.vaultId;
    if (!vaultId) {
      throw new Error('No vault created to prebond liquidity pool');
    }
    const { argonKeyring, rules, tip = 0n } = args;
    const client = await getMainchainClient();

    // need to leave enough for the BTC fees
    const { microgonsForLiquidity } = MyVault.getMicrogoonSplit(rules);

    const table = await this.getTable();

    let amountPerFrame = microgonsForLiquidity / 10n; // 10 frames
    const prebondAmount = () => amountPerFrame * 10n;
    let microgonsAlreadyUsed = this.metadata?.prebondedMicrogonsIncludingFee ?? 0n;
    console.log('Microgons already used for prebonding:', microgonsAlreadyUsed);

    if (microgonsAlreadyUsed === 0n) {
      const existing = await client.query.liquidityPools.prebondedByVaultId(vaultId);
      if (existing.isSome) {
        let amountAlreadyBonded = existing.unwrap().amountUnbonded.toBigInt();
        for (const bonded of existing.unwrap().bondedByStartOffset) {
          amountAlreadyBonded += bonded.toBigInt();
        }

        console.log(`Found existing prebonded amount`, amountAlreadyBonded);

        const tx = client.tx.liquidityPools.vaultOperatorPrebond(
          vaultId,
          amountAlreadyBonded,
          amountAlreadyBonded / 10n,
        );
        const txFee = await new TxSubmitter(client, tx, argonKeyring).feeEstimate(tip);

        this.metadata!.prebondedMicrogonsIncludingFee = amountAlreadyBonded + txFee + tip; // assume tip was same
        // we could go back and get this from the chain, but it's not critical
        this.metadata!.prebondedMicrogonsAtTick = await client.query.ticks.currentTick().then(x => x.toNumber() - 1);
        await table.save(this.metadata!);
      }
    }

    if (microgonsAlreadyUsed > 0n) {
      amountPerFrame = (microgonsForLiquidity - microgonsAlreadyUsed) / 10n;
    }

    let submitter = new TxSubmitter(
      client,
      client.tx.liquidityPools.vaultOperatorPrebond(vaultId, prebondAmount(), amountPerFrame),
      argonKeyring,
    );

    let txFee = await submitter.feeEstimate(tip);
    while (txFee + tip + microgonsAlreadyUsed + prebondAmount() > microgonsForLiquidity) {
      const total = microgonsForLiquidity - microgonsAlreadyUsed - txFee - tip;
      // now round it off so it adds up cleanly
      amountPerFrame = total / 10n;
      if (amountPerFrame <= 0n) {
        return null;
      }
      submitter.tx = client.tx.liquidityPools.vaultOperatorPrebond(vaultId, prebondAmount(), amountPerFrame);
      txFee = await submitter.feeEstimate(tip);
    }

    const { canAfford } = await submitter.canAfford({ tip, unavailableBalance: prebondAmount() });
    if (!canAfford) {
      throw new Error('Insufficient balance to prebond liquidity pool');
    }
    const txResult = await submitter.submit({ tip });
    const blockHash = await txResult.inBlockPromise;
    const api = await client.at(blockHash);
    const tick = await api.query.ticks.currentTick();

    console.log('Saving metadata for prebonded liquidity pool:', {
      prebond: prebondAmount(),
      microgonsAlreadyUsed,
      txFee,
      tip,
      meta: this.metadata,
    });
    this.metadata!.prebondedMicrogonsIncludingFee = prebondAmount() + microgonsAlreadyUsed + txFee + tip;
    this.metadata!.prebondedMicrogonsAtTick = tick.toNumber();
    await table.save(this.metadata!);
    return { txResult, prebondAmount };
  }

  public async recordPersonalBitcoinUtxoId(utxoId: number): Promise<void> {
    await this.load();
    const table = await this.getTable();
    this.metadata!.personalUtxoId = utxoId;
    await table.save(this.metadata!);
  }

  private async getTable(): Promise<VaultsTable> {
    this.#table ??= await this.dbPromise.then(x => x.vaultsTable);
    return this.#table;
  }

  public static getMicrogoonSplit(rules: IVaultingRules) {
    const bitcoinFee = 50_000n + rules.btcFlatFee + BigInt((rules.btcPctFee / 100) * Number(rules.personalBtcValue));
    const microgonsForVaulting = rules.requiredMicrogons - bitcoinFee;
    const microgonsForSecuritization = BigInt(
      BigNumber(rules.capitalForSecuritizationPct).div(100).times(microgonsForVaulting).toFixed(),
    );

    const microgonsForLiquidity = BigInt(
      BigNumber(rules.capitalForLiquidityPct).div(100).times(microgonsForVaulting).toFixed(),
    );
    return {
      microgonsForVaulting,
      microgonsForSecuritization,
      microgonsForLiquidity,
      maxBitcoinFee: bitcoinFee,
    };
  }
}
