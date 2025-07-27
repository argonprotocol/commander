import { ArgonClient, BitcoinLocks, type PalletVaultsVaultFrameFeeRevenue, Vault } from '@argonprotocol/mainchain';
import { getMainchain, getMainchainClient } from '../stores/mainchain.ts';
import { IBitcoinLockRecord } from './db/BitcoinLocksTable.ts';
import { convertBigIntStringToNumber, deferred, IDeferred } from './Utils.ts';
import { IVaultFrameStats, IAllVaultStats } from '../interfaces/IVaultStats.ts';
import mainnetVaultRevenueHistory from '../data/vaultRevenue.mainnet.json';
import testnetVaultRevenueHistory from '../data/vaultRevenue.testnet.json';
import { Mainchain } from '@argonprotocol/commander-calculator';
import { ILiquidityPoolDetails } from '@argonprotocol/commander-calculator/src/Mainchain.ts';
import { NETWORK_NAME } from './Config.ts';

export class Vaults {
  public readonly vaultsById: { [id: number]: Vault } = {};
  public tickDuration?: number;
  public stats?: IAllVaultStats;

  constructor(public network = NETWORK_NAME) {}

  private waitForLoad?: IDeferred;

  public async load(reload = false): Promise<void> {
    if (this.waitForLoad && !reload) return this.waitForLoad;

    this.waitForLoad ??= deferred();
    try {
      const client = await getMainchainClient();
      this.tickDuration ??= await client.query.ticks.genesisTicker().then(x => x.tickDurationMillis.toNumber());
      const vaults = await client.query.vaults.vaultsById.entries();
      for (const [vaultIdRaw, vaultRaw] of vaults) {
        const id = vaultIdRaw.args[0].toNumber();
        this.vaultsById[id] = new Vault(id, vaultRaw.unwrap(), this.tickDuration);
      }

      const { synchedToFrame, vaultsById } =
        this.network === 'mainnet' ? mainnetVaultRevenueHistory : testnetVaultRevenueHistory;
      if (!this.stats) {
        this.stats = { synchedToFrame, vaultsById: {} };
        for (const [vaultId, entry] of Object.entries(vaultsById)) {
          const { revenueByFrame, openedTick, baseline } = entry;
          const id = parseInt(vaultId, 10);
          this.stats.vaultsById[id] = {
            openedTick,
            baseline: {
              bitcoinLocks: baseline.bitcoinLocks,
              feeRevenue: convertBigIntStringToNumber(baseline.feeRevenue) ?? 0n,
              microgonLiquidityRealized: convertBigIntStringToNumber(baseline.microgonLiquidityRealized) ?? 0n,
              satoshis: convertBigIntStringToNumber(baseline.satoshis) ?? 0n,
            },
            changesByFrame: revenueByFrame.map(change => ({
              frameId: change.frameId,
              satoshisAdded: convertBigIntStringToNumber(change.satoshisAdded) ?? 0n,
              bitcoinLocksCreated: change.bitcoinLocksCreated,
              microgonLiquidityAdded: convertBigIntStringToNumber(change.microgonLiquidityAdded) ?? 0n,
              feeRevenue: convertBigIntStringToNumber(change.feeRevenue) ?? 0n,
              isFrameInProgress: change.isFrameInProgress,
              securitization: convertBigIntStringToNumber(change.securitization) ?? 0n,
              securitizationActivated: convertBigIntStringToNumber(change.securitizationActivated) ?? 0n,
              liquidityPool: {
                sharingPercent: change.liquidityPool.sharingPercent,
                contributedCapital: convertBigIntStringToNumber(change.liquidityPool.contributedCapital) ?? 0n,
                contributedCapitalByVaultOperator:
                  convertBigIntStringToNumber(change.liquidityPool.contributedCapitalByVaultOperator) ?? 0n,
                contributorProfit: convertBigIntStringToNumber(change.liquidityPool.contributorProfit) ?? 0n,
                vaultProfit: convertBigIntStringToNumber(change.liquidityPool.vaultProfit) ?? 0n,
              },
            })),
          };
        }
      }
      this.waitForLoad.resolve();
    } catch (error) {
      this.waitForLoad.reject(error as Error);
    }
    return this.waitForLoad;
  }

  public async updateVaultRevenue(args: {
    vaultId: number;
    api: ArgonClient;
    frameId: number;
    currentFrameId: number;
    frameRevenue: PalletVaultsVaultFrameFeeRevenue | undefined;
    liquidityPoolFrame: ILiquidityPoolDetails | undefined;
  }) {
    const { vaultId, api, frameId, currentFrameId, frameRevenue, liquidityPoolFrame } = args;
    this.stats ??= { synchedToFrame: 0, vaultsById: {} };
    this.stats.vaultsById[vaultId] ??= {
      openedTick: this.vaultsById[vaultId]?.openedTick ?? 0n,
      baseline: {
        bitcoinLocks: 0,
        feeRevenue: 0n,
        microgonLiquidityRealized: 0n,
        satoshis: 0n,
      },
      changesByFrame: [],
    };

    const frameChanges = this.stats.vaultsById[vaultId].changesByFrame;
    const existing = frameChanges.find(x => frameId === x.frameId);
    if (existing && !existing.isFrameInProgress) return;

    const vault = await Vault.get(api, vaultId, this.tickDuration!);

    const entry = <IVaultFrameStats>{
      satoshisAdded:
        (frameRevenue?.bitcoinLocksTotalSatoshis.toBigInt() ?? 0n) - (frameRevenue?.satoshisReleased.toBigInt() ?? 0n),
      frameId,
      microgonLiquidityAdded: frameRevenue?.bitcoinLocksMarketValue.toBigInt() ?? 0n,
      feeRevenue: frameRevenue?.feeRevenue.toBigInt() ?? 0n,
      bitcoinLocksCreated: frameRevenue?.bitcoinLocksCreated.toNumber() ?? 0,
      isFrameInProgress: frameId >= currentFrameId,
      liquidityPool: {
        sharingPercent: liquidityPoolFrame?.sharingPercent ?? 0,
        contributedCapital: liquidityPoolFrame?.contributedCapital ?? 0n,
        contributedCapitalByVaultOperator: liquidityPoolFrame?.contributors[vault.operatorAccountId] ?? 0n,
        contributorProfit: liquidityPoolFrame?.contributorProfit ?? 0n,
        vaultProfit: liquidityPoolFrame?.vaultProfit ?? 0n,
      },
      securitization: vault.securitization,
      securitizationActivated: vault.activatedSecuritization(),
    };
    if (existing) {
      Object.assign(existing, entry);
    } else {
      // insert with highest frameId first
      const position = frameChanges.findIndex(x => x.frameId < frameId);
      if (position >= 0) {
        frameChanges.splice(position, 0, entry);
      } else {
        frameChanges.push(entry);
      }
    }
  }

  public async refreshRevenue() {
    await this.load();
    const mainchain = getMainchain();
    const client = await getMainchainClient();

    const revenue = this.stats ?? { synchedToFrame: 0, vaultsById: {} };
    const oldestFrameToGet = revenue.synchedToFrame;

    console.log('Synching vault revenue stats back to frame ', oldestFrameToGet);

    let currentFrameId = await client.query.miningSlot.nextFrameId().then(x => x.toNumber() - 1);
    await mainchain.forEachFrame(false, async (justEndedFrameId, api, meta, abortController) => {
      const vaultRevenue = await api.query.vaults.perFrameFeeRevenueByVault.entries();
      const frameLiquidity = await api.query.liquidityPools.vaultPoolsByFrame(justEndedFrameId);
      const liquidityPool = Mainchain.translateFrameLiquidityPools(frameLiquidity);
      const revenueByVault: { [vaultId: number]: PalletVaultsVaultFrameFeeRevenue | undefined } = {};
      for (const [vaultIdRaw, revenueEntry] of vaultRevenue) {
        const vaultId = vaultIdRaw.args[0].toNumber();
        revenueByVault[vaultId] = revenueEntry.find(x => x.frameId.toNumber() === justEndedFrameId);
      }

      const vaultIds = new Set([
        ...Object.keys(revenueByVault).map(Number),
        ...[...frameLiquidity.keys()].map(x => x.toNumber()),
      ]);
      for (const vaultId of vaultIds) {
        const liquidityPoolFrame = liquidityPool[vaultId];
        const frameRevenue = revenueByVault[vaultId];
        await this.updateVaultRevenue({
          vaultId,
          api,
          frameId: justEndedFrameId,
          currentFrameId,
          frameRevenue,
          liquidityPoolFrame,
        });
      }

      const isDone = justEndedFrameId <= oldestFrameToGet || meta.specVersion < 123;

      if (isDone) {
        console.log(`Synched vault revenue to frame ${justEndedFrameId}`);
        abortController.abort();
      }
    });
    revenue.synchedToFrame = currentFrameId - 1;
    return revenue;
  }

  public getTrailingYearVaultRevenue(vaultId: number): bigint {
    const vaultRevenue = this.stats?.vaultsById[vaultId];
    if (!vaultRevenue) return 0n;

    return vaultRevenue.changesByFrame.slice(0, 365).reduce((total, change) => total + change.feeRevenue, 0n);
  }

  public async getTotalLiquidityRealized(refresh = true) {
    if (refresh) {
      await this.refreshRevenue();
    }
    return Object.values(this.stats!.vaultsById).reduce((total, vault) => {
      return (
        total +
        vault.baseline.microgonLiquidityRealized +
        vault.changesByFrame.reduce((sum, change) => sum + change.microgonLiquidityAdded, 0n)
      );
    }, 0n);
  }

  public getTotalSatoshisLocked(): bigint {
    if (!this.stats) return 0n;
    return Object.values(this.stats!.vaultsById).reduce((total, vault) => {
      return (
        total + vault.baseline.satoshis + vault.changesByFrame.reduce((sum, change) => sum + change.satoshisAdded, 0n)
      );
    }, 0n);
  }

  public async getRatchetPrice(
    lock: IBitcoinLockRecord,
  ): Promise<{ burnAmount: bigint; ratchetingFee: bigint; marketRate: bigint }> {
    const vault = this.vaultsById[lock.vaultId];
    if (!vault) throw new Error('Vault not found');
    const ratchetPrice = new BitcoinLocks(getMainchainClient()).getRatchetPrice(lock.lockDetails, vault);

    return {
      ...ratchetPrice,
    };
  }

  public async getRedemptionRate(satoshis: bigint): Promise<bigint> {
    return await new BitcoinLocks(getMainchainClient()).getRedemptionRate(satoshis);
  }

  public async getMarketRate(satoshis: bigint): Promise<bigint> {
    return await new BitcoinLocks(getMainchainClient()).getMarketRate(satoshis);
  }

  public async calculateReleasePrice(satoshis: bigint, lockPrice: bigint): Promise<bigint> {
    let lowestPrice = await this.getRedemptionRate(satoshis);
    if (lockPrice < lowestPrice) {
      lowestPrice = lockPrice;
    }
    return lowestPrice;
  }
}
