import { BitcoinLocks, JsonExt, type PalletVaultsVaultFrameRevenue, Vault } from '@argonprotocol/mainchain';
import { BaseDirectory, readTextFile, rename, writeTextFile } from '@tauri-apps/plugin-fs';
import { getMainchain, getMainchainClient } from '../stores/mainchain.ts';
import { IBitcoinLockRecord } from './db/BitcoinLocksTable.ts';
import { convertBigIntStringToNumber, createDeferred, IDeferred } from './Utils.ts';
import { IAllVaultStats, IVaultFrameStats } from '../interfaces/IVaultStats.ts';
import mainnetVaultRevenueHistory from '../data/vaultRevenue.mainnet.json';
import testnetVaultRevenueHistory from '../data/vaultRevenue.testnet.json';
import { NETWORK_NAME } from './Config.ts';
import { Mainchain } from '@argonprotocol/commander-calculator';

const REVENUE_STATS_FILE = `${NETWORK_NAME}/vaultRevenue.json`;

export class Vaults {
  public readonly vaultsById: { [id: number]: Vault } = {};
  public tickDuration?: number;
  public stats?: IAllVaultStats;

  constructor(public network = NETWORK_NAME) {}

  private waitForLoad?: IDeferred;
  private isSavingStats: boolean = false;

  public async load(reload = false): Promise<void> {
    if (this.waitForLoad && !reload) return this.waitForLoad.promise;

    this.waitForLoad ??= createDeferred();
    try {
      const client = await getMainchainClient();
      this.tickDuration ??= await client.query.ticks.genesisTicker().then(x => x.tickDurationMillis.toNumber());
      const vaults = await client.query.vaults.vaultsById.entries();
      for (const [vaultIdRaw, vaultRaw] of vaults) {
        const id = vaultIdRaw.args[0].toNumber();
        this.vaultsById[id] = new Vault(id, vaultRaw.unwrap(), this.tickDuration);
      }

      this.stats ??= await this.loadStatsFromFile();
      this.waitForLoad.resolve();
    } catch (error) {
      this.waitForLoad.reject(error as Error);
    }
    return this.waitForLoad.promise;
  }

  public async updateVaultRevenue(vaultId: number, frameRevenues: PalletVaultsVaultFrameRevenue[], skipSaving = false) {
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
    for (const frameRevenue of frameRevenues) {
      const frameId = frameRevenue.frameId.toNumber();
      const existing = frameChanges.find(x => frameId === x.frameId);

      const entry = {
        satoshisAdded: frameRevenue.bitcoinLocksTotalSatoshis.toBigInt() - frameRevenue.satoshisReleased.toBigInt(),
        frameId,
        microgonLiquidityAdded: frameRevenue.bitcoinLocksMarketValue.toBigInt(),
        bitcoinFeeRevenue: frameRevenue.bitcoinLockFeeRevenue.toBigInt(),
        bitcoinLocksCreated: frameRevenue.bitcoinLocksCreated.toNumber(),
        liquidityPool: {
          totalEarnings: frameRevenue.liquidityPoolTotalEarnings.toBigInt(),
          vaultEarnings: frameRevenue.liquidityPoolVaultEarnings.toBigInt(),
          externalCapital: frameRevenue.liquidityPoolExternalCapital.toBigInt(),
          vaultCapital: frameRevenue.liquidityPoolVaultCapital.toBigInt(),
        },
        securitization: frameRevenue.securitization.toBigInt(),
        securitizationActivated: frameRevenue.securitizationActivated.toBigInt(),
        uncollectedEarnings: frameRevenue.uncollectedRevenue.toBigInt(),
      } as IVaultFrameStats;
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

    if (!skipSaving) {
      void this.saveStats();
    }
  }

  public async refreshRevenue(mainchain?: Mainchain): Promise<IAllVaultStats> {
    await this.load();
    mainchain ??= getMainchain();
    const client = await mainchain.clientPromise;

    const revenue = this.stats ?? { synchedToFrame: 0, vaultsById: {} };
    const oldestFrameToGet = revenue.synchedToFrame;

    console.log('Synching vault revenue stats back to frame ', oldestFrameToGet);

    const currentFrameId = await client.query.miningSlot.nextFrameId().then(x => x.toNumber() - 1);
    await mainchain.forEachFrame(false, async (justEndedFrameId, api, meta, abortController) => {
      if (meta.specVersion < 129) {
        abortController.abort();
        return;
      }
      const vaultRevenues = await api.query.vaults.revenuePerFrameByVault.entries();
      for (const [vaultIdRaw, frameRevenues] of vaultRevenues) {
        const vaultId = vaultIdRaw.args[0].toNumber();
        await this.updateVaultRevenue(vaultId, frameRevenues, true);
      }

      const isDone = justEndedFrameId <= oldestFrameToGet || meta.specVersion < 123;

      if (isDone) {
        console.log(`Synched vault revenue to frame ${justEndedFrameId}`);
        abortController.abort();
      }
    });
    revenue.synchedToFrame = currentFrameId - 1;
    void this.saveStats();
    return revenue;
  }

  public contributedCapital(vaultId: number, minimumFrameId: number, maxFrames = 10): bigint {
    const vaultRevenue = this.stats?.vaultsById[vaultId];
    if (!vaultRevenue) return 0n;

    return vaultRevenue.changesByFrame
      .slice(0, maxFrames)
      .reduce((total, change) => total + change.liquidityPool.externalCapital + change.liquidityPool.vaultCapital, 0n);
  }

  public poolEarnings(vaultId: number, minimumFrameId: number, maxFrames = 10): bigint {
    const vaultRevenue = this.stats?.vaultsById[vaultId];
    if (!vaultRevenue) return 0n;

    return vaultRevenue.changesByFrame
      .slice(0, maxFrames)
      .reduce((total, change) => total + change.liquidityPool.totalEarnings, 0n);
  }

  public getTrailingYearVaultRevenue(vaultId: number): bigint {
    const vaultRevenue = this.stats?.vaultsById[vaultId];
    if (!vaultRevenue) return 0n;

    return vaultRevenue.changesByFrame.slice(0, 365).reduce((total, change) => total + change.bitcoinFeeRevenue, 0n);
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
    return Object.values(this.stats.vaultsById).reduce((total, vault) => {
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
    const ratchetPrice = await new BitcoinLocks(getMainchainClient()).getRatchetPrice(lock.lockDetails, vault);

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

  private async saveStats(): Promise<void> {
    if (!this.stats) return;
    if (this.isSavingStats) return;
    this.isSavingStats = true;
    try {
      const statsJson = JsonExt.stringify(this.stats, 2);
      await writeTextFile(REVENUE_STATS_FILE + '.tmp', statsJson, {
        baseDir: BaseDirectory.AppLocalData,
      }).catch(error => {
        console.error('Error saving vault stats:', error);
      });
      await rename(REVENUE_STATS_FILE + '.tmp', REVENUE_STATS_FILE, {
        oldPathBaseDir: BaseDirectory.AppLocalData,
        newPathBaseDir: BaseDirectory.AppLocalData,
      }).catch(error => {
        console.error('Error renaming vault stats file:', error);
      });
    } finally {
      this.isSavingStats = false;
    }
  }

  private async loadStatsFromFile(): Promise<IAllVaultStats> {
    console.log('load stats from file', REVENUE_STATS_FILE);
    const state = await readTextFile(REVENUE_STATS_FILE, {
      baseDir: BaseDirectory.AppLocalData,
    }).catch(() => undefined);
    if (state) {
      return JsonExt.parse(state);
    }

    const { synchedToFrame, vaultsById } =
      this.network === 'mainnet' ? mainnetVaultRevenueHistory : testnetVaultRevenueHistory;
    const stats: (typeof this)['stats'] = { synchedToFrame, vaultsById: {} };
    for (const [vaultId, entry] of Object.entries(vaultsById)) {
      const { changesByFrame, openedTick, baseline } = entry;
      const id = parseInt(vaultId, 10);
      stats.vaultsById[id] = {
        openedTick,
        baseline: {
          bitcoinLocks: baseline.bitcoinLocks,
          feeRevenue: convertBigIntStringToNumber(baseline.feeRevenue as any) ?? 0n,
          microgonLiquidityRealized: convertBigIntStringToNumber(baseline.microgonLiquidityRealized as any) ?? 0n,
          satoshis: convertBigIntStringToNumber(baseline.satoshis as any) ?? 0n,
        },
        changesByFrame: changesByFrame.map((change: IVaultFrameStats) => ({
          frameId: change.frameId,
          satoshisAdded: convertBigIntStringToNumber(change.satoshisAdded as any) ?? 0n,
          bitcoinLocksCreated: change.bitcoinLocksCreated,
          microgonLiquidityAdded: convertBigIntStringToNumber(change.microgonLiquidityAdded as any) ?? 0n,
          bitcoinFeeRevenue: convertBigIntStringToNumber(change.bitcoinFeeRevenue as any) ?? 0n,
          securitization: convertBigIntStringToNumber(change.securitization as any) ?? 0n,
          securitizationActivated: convertBigIntStringToNumber(change.securitizationActivated as any) ?? 0n,
          liquidityPool: {
            externalCapital: convertBigIntStringToNumber(change.liquidityPool.externalCapital as any) ?? 0n,
            vaultCapital: convertBigIntStringToNumber(change.liquidityPool.vaultCapital as any) ?? 0n,
            totalEarnings: convertBigIntStringToNumber(change.liquidityPool.totalEarnings as any) ?? 0n,
            vaultEarnings: convertBigIntStringToNumber(change.liquidityPool.vaultEarnings as any) ?? 0n,
          },
          uncollectedEarnings: 0n,
        })),
      };
    }
    for (const vault of Object.values(this.vaultsById)) {
      stats.vaultsById[vault.vaultId] ??= {
        openedTick: vault.openedTick,
        baseline: {
          bitcoinLocks: 0,
          feeRevenue: 0n,
          microgonLiquidityRealized: 0n,
          satoshis: 0n,
        },
        changesByFrame: [],
      };
    }
    return stats;
  }
}
