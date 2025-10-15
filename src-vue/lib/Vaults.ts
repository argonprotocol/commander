import { BitcoinLocks, type PalletVaultsVaultFrameRevenue, Vault } from '@argonprotocol/mainchain';
import { bigNumberToBigInt, FrameIterator, JsonExt, MainchainClients, PriceIndex } from '@argonprotocol/commander-core';
import { BaseDirectory, mkdir, readTextFile, rename, writeTextFile } from '@tauri-apps/plugin-fs';
import { getMainchainClient, getMainchainClients } from '../stores/mainchain.ts';
import { IBitcoinLockRecord } from './db/BitcoinLocksTable.ts';
import { convertBigIntStringToNumber, createDeferred, IDeferred } from './Utils.ts';
import { IAllVaultStats, IVaultFrameStats } from '../interfaces/IVaultStats.ts';
import mainnetVaultRevenueHistory from '../data/vaultRevenue.mainnet.json';
import testnetVaultRevenueHistory from '../data/vaultRevenue.testnet.json';
import { NETWORK_NAME } from './Env.ts';
import BigNumber from 'bignumber.js';

const REVENUE_STATS_FILE = `${NETWORK_NAME}/vaultRevenue.json`;

export class Vaults {
  public readonly vaultsById: { [id: number]: Vault } = {};
  public tickDuration?: number;
  public stats?: IAllVaultStats;

  constructor(
    public network = NETWORK_NAME,
    public priceIndex: PriceIndex,
  ) {}

  private waitForLoad?: IDeferred;
  private isSavingStats: boolean = false;

  private get bitcoinLocks(): Promise<BitcoinLocks> {
    return getMainchainClient(false).then(x => new BitcoinLocks(x));
  }

  public async load(reload = false): Promise<void> {
    if (this.waitForLoad && !reload) return this.waitForLoad.promise;

    this.waitForLoad ??= createDeferred();
    try {
      const client = await getMainchainClient(false);
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
        treasuryPool: {
          totalEarnings: frameRevenue.treasuryTotalEarnings.toBigInt(),
          vaultEarnings: frameRevenue.treasuryVaultEarnings.toBigInt(),
          externalCapital: frameRevenue.treasuryExternalCapital.toBigInt(),
          vaultCapital: frameRevenue.treasuryVaultCapital.toBigInt(),
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

  public async refreshRevenue(clients?: MainchainClients): Promise<IAllVaultStats> {
    await this.load();
    clients ??= getMainchainClients();
    const client = await clients.prunedClientOrArchivePromise;

    const revenue = this.stats ?? { synchedToFrame: 0, vaultsById: {} };
    const oldestFrameToGet = revenue.synchedToFrame;

    console.log('Synching vault revenue stats back to frame ', oldestFrameToGet);

    const currentFrameId = await client.query.miningSlot.nextFrameId().then(x => x.toNumber() - 1);
    await new FrameIterator(clients, false, 'VaultRevenueStats').forEachFrame(
      async (frameId, firstBlockMeta, api, abortController) => {
        if (firstBlockMeta.specVersion < 129) {
          abortController.abort();
          return;
        }
        const vaultRevenues = await api.query.vaults.revenuePerFrameByVault.entries();
        for (const [vaultIdRaw, frameRevenues] of vaultRevenues) {
          const vaultId = vaultIdRaw.args[0].toNumber();
          await this.updateVaultRevenue(vaultId, frameRevenues, true);
        }

        const isDone = frameId <= oldestFrameToGet || firstBlockMeta.specVersion < 123;

        if (isDone) {
          console.log(`Synched vault revenue to frame ${frameId}`);
          abortController.abort();
        }
      },
    );
    revenue.synchedToFrame = currentFrameId - 1;
    void this.saveStats();
    return revenue;
  }

  public contributedTreasuryCapital(vaultId: number, maxFrames = 10): bigint {
    const vaultRevenue = this.stats?.vaultsById[vaultId];
    if (!vaultRevenue) return 0n;

    return vaultRevenue.changesByFrame
      .slice(0, maxFrames)
      .reduce((total, change) => total + change.treasuryPool.externalCapital + change.treasuryPool.vaultCapital, 0n);
  }

  public treasuryPoolEarnings(vaultId: number, maxFrames = 10): bigint {
    const vaultRevenue = this.stats?.vaultsById[vaultId];
    if (!vaultRevenue) return 0n;

    return vaultRevenue.changesByFrame
      .slice(0, maxFrames)
      .reduce((total, change) => total + change.treasuryPool.totalEarnings, 0n);
  }

  public getTrailingYearVaultRevenue(vaultId: number): bigint {
    const vaultRevenue = this.stats?.vaultsById[vaultId];
    if (!vaultRevenue) return 0n;

    return vaultRevenue.changesByFrame.slice(0, 365).reduce((total, change) => total + change.bitcoinFeeRevenue, 0n);
  }

  public getLockedBitcoin(vaultId: number): bigint {
    const vaultRevenue = this.stats?.vaultsById[vaultId];
    if (!vaultRevenue) return 0n;

    return (
      vaultRevenue.changesByFrame.reduce((total, change) => total + change.satoshisAdded, 0n) +
      vaultRevenue.baseline.satoshis
    );
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

  public getTotalFeeRevenue(vaultId: number): bigint {
    const vault = this.vaultsById[vaultId];
    if (!vault) return 0n;

    const vaultRevenue = this.stats?.vaultsById[vaultId];
    if (!vaultRevenue) return 0n;

    return (
      vaultRevenue.baseline.feeRevenue +
      vaultRevenue.changesByFrame.reduce((sum, change) => sum + change.bitcoinFeeRevenue, 0n)
    );
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
    await this.priceIndex.fetchMicrogonExchangeRatesTo();
    const bitcoinLocks = await this.bitcoinLocks;
    const ratchetPrice = await bitcoinLocks.getRatchetPrice(lock.lockDetails, this.priceIndex.current, vault);

    return {
      ...ratchetPrice,
    };
  }

  public async getRedemptionRate(lock: { satoshis: bigint; peggedPrice?: bigint }): Promise<bigint> {
    await this.priceIndex.fetchMicrogonExchangeRatesTo();
    const bitcoinLocks = await this.bitcoinLocks;
    return await bitcoinLocks.getRedemptionRate(this.priceIndex.current, lock);
  }

  public async getMarketRate(satoshis: bigint): Promise<bigint> {
    await this.priceIndex.fetchMicrogonExchangeRatesTo();
    const bitcoinLocks = await this.bitcoinLocks;
    return await bitcoinLocks.getMarketRate(this.priceIndex.current, satoshis);
  }

  public getTreasuryFillPct(vaultId: number): number {
    const vault = this.vaultsById[vaultId];
    if (!vault) return 0;

    const epochPoolCapital = Number(this.contributedTreasuryCapital(vaultId, 10));
    const activatedSecuritization = Number(
      this.stats?.vaultsById[vaultId]?.changesByFrame[0]?.securitizationActivated ?? 0n,
    );

    if (activatedSecuritization === 0) return 0;

    return Math.round((epochPoolCapital / activatedSecuritization) * 100);
  }

  public calculateVaultApy(vaultId: number): number {
    const vault = this.vaultsById[vaultId];

    const yearFeeRevenue = Number(this.getTrailingYearVaultRevenue(vaultId));

    const epochPoolCapital = Number(this.contributedTreasuryCapital(vaultId, 10));

    const epochPoolEarnings = Number(this.treasuryPoolEarnings(vaultId, 10));
    const epochPoolEarningsRatio = epochPoolCapital ? epochPoolEarnings / epochPoolCapital : 0;

    const poolApy = (1 + epochPoolEarningsRatio) ** 36.5 - 1;
    const feeApr = vault.securitization > 0n ? yearFeeRevenue / Number(vault.securitization) : 0;

    return poolApy + feeApr;
  }

  private async saveStats(): Promise<void> {
    if (!this.stats) return;
    if (this.isSavingStats) return;
    this.isSavingStats = true;
    try {
      const statsJson = JsonExt.stringify(this.stats, 2);
      await mkdir(`${NETWORK_NAME}`, { baseDir: BaseDirectory.AppConfig, recursive: true }).catch(() => null);
      await writeTextFile(REVENUE_STATS_FILE + '.tmp', statsJson, {
        baseDir: BaseDirectory.AppConfig,
      }).catch(error => {
        console.error('Error saving vault stats:', error);
      });
      await rename(REVENUE_STATS_FILE + '.tmp', REVENUE_STATS_FILE, {
        oldPathBaseDir: BaseDirectory.AppConfig,
        newPathBaseDir: BaseDirectory.AppConfig,
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
      baseDir: BaseDirectory.AppConfig,
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
        changesByFrame: changesByFrame.map(
          change =>
            ({
              frameId: change.frameId,
              satoshisAdded: convertBigIntStringToNumber(change.satoshisAdded as any) ?? 0n,
              bitcoinLocksCreated: change.bitcoinLocksCreated,
              microgonLiquidityAdded: convertBigIntStringToNumber(change.microgonLiquidityAdded as any) ?? 0n,
              bitcoinFeeRevenue: convertBigIntStringToNumber(change.bitcoinFeeRevenue as any) ?? 0n,
              securitization: convertBigIntStringToNumber(change.securitization as any) ?? 0n,
              securitizationActivated: convertBigIntStringToNumber(change.securitizationActivated as any) ?? 0n,
              treasuryPool: {
                externalCapital: convertBigIntStringToNumber(change.treasuryPool.externalCapital as any) ?? 0n,
                vaultCapital: convertBigIntStringToNumber(change.treasuryPool.vaultCapital as any) ?? 0n,
                totalEarnings: convertBigIntStringToNumber(change.treasuryPool.totalEarnings as any) ?? 0n,
                vaultEarnings: convertBigIntStringToNumber(change.treasuryPool.vaultEarnings as any) ?? 0n,
              },
              uncollectedEarnings: 0n,
            }) as IVaultFrameStats,
        ),
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

  public static async getTreasuryPoolPayout(
    clients: MainchainClients,
  ): Promise<{ totalPoolRewards: bigint; totalActivatedCapital: bigint; participatingVaults: number }> {
    const client = await clients.prunedClientOrArchivePromise;
    const minersAtFrame = await client.query.miningSlot.minersByCohort.entries();
    const vaultRevenue = await client.query.vaults.revenuePerFrameByVault.entries();
    let totalMicrogonsBid = 0n;
    let totalActivatedCapital = 0n;
    for (const [_cohort, miners] of minersAtFrame) {
      for (const miner of miners) {
        totalMicrogonsBid += miner.bid.toBigInt();
      }
    }

    let participatingVaults = 0;
    for (const [_vaultId, revenue] of vaultRevenue) {
      for (const entry of revenue) {
        const capital = entry.treasuryVaultCapital.toBigInt() + entry.treasuryExternalCapital.toBigInt();
        if (capital > 0n) {
          participatingVaults++;
          totalActivatedCapital += capital;
        }
      }
    }

    // treasury burns 20% of total bids
    const totalPoolRewardsBn = BigNumber(totalMicrogonsBid).multipliedBy(0.8);
    const totalPoolRewards = bigNumberToBigInt(totalPoolRewardsBn);

    return {
      totalPoolRewards,
      totalActivatedCapital,
      participatingVaults,
    };
  }
}
