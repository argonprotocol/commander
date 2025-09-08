import BigNumber from 'bignumber.js';
import { bigNumberToBigInt, MainchainClients } from '@argonprotocol/commander-core';
import { Config } from './Config';
import { calculateAPY, createDeferred } from './Utils';
import { bigIntMax } from '@argonprotocol/commander-core/src/utils';
import { Vaults } from './Vaults.ts';

export class VaultCalculator {
  private rules!: Config['vaultingRules'];
  private readonly clients: MainchainClients;
  private isLoaded = createDeferred(false);

  public epochPoolRewards!: bigint;
  public epochPoolCapitalTotal!: bigint;

  constructor(mainchainClients: MainchainClients) {
    this.clients = mainchainClients;
  }

  async load(rules: Config['vaultingRules']) {
    if (this.isLoaded.isRunning || this.isLoaded.isSettled) {
      return this.isLoaded.promise;
    }
    this.isLoaded.setIsRunning(true);
    this.rules = rules;
    try {
      const { totalPoolRewards, totalActivatedCapital } = await Vaults.getTreasuryPoolPayout(this.clients);
      this.epochPoolRewards = totalPoolRewards;
      this.epochPoolCapitalTotal = totalActivatedCapital;
      this.isLoaded.resolve();
    } catch (e) {
      this.isLoaded.reject(e);
      throw e;
    }
  }

  public calculateInternalAPY(btcUtilization: 'Low' | 'High', poolUtilization: 'Low' | 'High'): number {
    const vaultRevenue = this.calculateInternalRevenue(btcUtilization, poolUtilization);
    const vaultCost = this.rules.baseMicrogonCommitment;

    return calculateAPY(vaultCost, vaultCost + vaultRevenue);
  }

  public calculateInternalRevenue(btcUtilization: 'Low' | 'High', poolUtilization: 'Low' | 'High'): bigint {
    const { profitSharingPct } = this.rules;

    const totalPoolCapital = this.calculateTotalPoolCapital(btcUtilization, poolUtilization);
    const totalPoolRevenue = this.calculateTotalPoolRevenue(btcUtilization, poolUtilization);
    const internalBtcRevenue = this.calculateInternalBtcRevenue(btcUtilization);

    const externalPoolCapital = this.calculateExternalPoolCapital(btcUtilization);

    const externalFactorBn = totalPoolCapital
      ? BigNumber(externalPoolCapital).dividedBy(totalPoolCapital)
      : BigNumber(0);
    const internalFactorBn = BigNumber(1).minus(externalFactorBn);

    const revenueFromExternalBn = BigNumber(totalPoolRevenue)
      .multipliedBy(externalFactorBn)
      .multipliedBy(1 - profitSharingPct / 100);
    const revenueFromExternal = bigNumberToBigInt(revenueFromExternalBn);

    const revenueFromInternalBn = BigNumber(totalPoolRevenue).multipliedBy(internalFactorBn);
    const revenueFromInternal = bigNumberToBigInt(revenueFromInternalBn);

    return revenueFromInternal + revenueFromExternal + internalBtcRevenue;
  }

  public calculateExternalAPY(btcUtilization: 'Low' | 'High', poolUtilization: 'Low' | 'High'): number {
    const { profitSharingPct } = this.rules;
    const totalPoolCapital = this.calculateTotalPoolCapital(btcUtilization, poolUtilization);
    const externalPoolCapital = this.calculateExternalPoolCapital(btcUtilization);

    const externalFactorBn = totalPoolCapital
      ? BigNumber(externalPoolCapital).dividedBy(totalPoolCapital)
      : BigNumber(0);

    const totalPoolRevenue = this.calculateTotalPoolRevenue(btcUtilization, poolUtilization);

    const externalPoolRevenueBn = BigNumber(totalPoolRevenue)
      .multipliedBy(externalFactorBn)
      .multipliedBy(profitSharingPct / 100);
    const externalPoolRevenue = bigNumberToBigInt(externalPoolRevenueBn);

    return calculateAPY(externalPoolCapital, externalPoolCapital + externalPoolRevenue);
  }

  public calculateSecuritization(): bigint {
    // this function has no utilization parameter because BTC space is only dependent on pool capital
    const { baseMicrogonCommitment, capitalForSecuritizationPct } = this.rules;

    const btcSecuritizationBn = BigNumber(baseMicrogonCommitment).multipliedBy(capitalForSecuritizationPct / 100);
    return bigNumberToBigInt(btcSecuritizationBn);
  }

  public calculateBtcSpaceInMicrogons(): bigint {
    // this function has no utilization parameter because BTC space is only dependent on pool capital
    const { baseMicrogonCommitment: vaultCapital, capitalForSecuritizationPct, securitizationRatio } = this.rules;

    const vaultCapitalBn = BigNumber(vaultCapital);
    const btcSecuritizationBn = vaultCapitalBn.multipliedBy(capitalForSecuritizationPct / 100);
    const btcSpaceInMicrogonsBn = btcSecuritizationBn.dividedBy(securitizationRatio);

    return bigNumberToBigInt(btcSpaceInMicrogonsBn);
  }

  public personalBtcInMicrogons(): bigint {
    const btcSpaceInMicrogons = this.calculateBtcSpaceInMicrogons();
    const personalBtcInMicrogonsBn = BigNumber(btcSpaceInMicrogons).multipliedBy(this.rules.personalBtcPct).div(100);

    return bigNumberToBigInt(personalBtcInMicrogonsBn);
  }

  public calculateInternalBtcRevenue(utilization: 'Low' | 'High'): bigint {
    const personalBtcInMicrogons = this.personalBtcInMicrogons();
    const btcUtilizedInMicrogons = this.calculateBtcUtilizedInMicrogons(utilization);
    const btcSellableInMicrogons = BigNumber(btcUtilizedInMicrogons).minus(personalBtcInMicrogons).toNumber();

    let totalRevenueFromBtcBn = BigNumber(btcSellableInMicrogons).multipliedBy(this.rules.btcPctFee / 100);
    if (btcSellableInMicrogons > 0n) {
      // TODO: this assumes all the BTC space is taken in a single transaction. We need a more sophisticated model for this.
      totalRevenueFromBtcBn = totalRevenueFromBtcBn.plus(this.rules.btcFlatFee);
    }

    return bigNumberToBigInt(totalRevenueFromBtcBn.dividedBy(36.5));
  }

  private calculateBtcUtilizedInMicrogons(utilization: 'Low' | 'High' | 'Full'): bigint {
    const { btcUtilizationPct } = this.extractRulesFor(utilization);
    const btcSpaceInMicrogons = this.calculateBtcSpaceInMicrogons();
    const btcUtilizedInMicrogonsBn = BigNumber(btcSpaceInMicrogons).multipliedBy(btcUtilizationPct / 100);
    const btcUtilizedInMicrogons = bigNumberToBigInt(btcUtilizedInMicrogonsBn);

    return bigIntMax(btcUtilizedInMicrogons, this.personalBtcInMicrogons());
  }

  public calculateTotalPoolSpace(utilization: 'Low' | 'High' | 'Full'): bigint {
    // Ultimately the pool space is dependent on how much BTC is in the vault
    const btcUtilizedInMicrogons = this.calculateBtcUtilizedInMicrogons(utilization);
    const securitizationRatio = Math.max(this.rules.securitizationRatio, 200);
    const securitizationRatioBn = BigNumber(securitizationRatio).div(100);
    const activatedSecuritizationBn = BigNumber(btcUtilizedInMicrogons).multipliedBy(securitizationRatioBn);
    return bigNumberToBigInt(activatedSecuritizationBn);
  }

  public calculateTotalPoolCapital(btcUtilization: 'Low' | 'High', poolUtilization: 'Low' | 'High'): bigint {
    const totalPoolSpace = this.calculateTotalPoolSpace(btcUtilization);
    const poolUtilizationPct =
      poolUtilization === 'Low' ? this.rules.poolUtilizationPctMin : this.rules.poolUtilizationPctMax;
    const poolCapitalBn = BigNumber(totalPoolSpace).multipliedBy(poolUtilizationPct / 100);
    const poolCapital = bigNumberToBigInt(poolCapitalBn);
    const internalPoolCapital = this.calculateInternalPoolCapital();

    return bigIntMax(internalPoolCapital, poolCapital);
  }

  public calculateInternalPoolCapital(): bigint {
    const { baseMicrogonCommitment: internalCapital, capitalForTreasuryPct } = this.rules;

    const internalCapitalBn = BigNumber(internalCapital);
    const internalPoolCapitalBn = internalCapitalBn.multipliedBy(capitalForTreasuryPct / 100);
    return bigNumberToBigInt(internalPoolCapitalBn);
  }

  public calculateExternalPoolCapital(btcUtilization: 'Low' | 'High'): bigint {
    const totalPoolSpace = this.calculateTotalPoolSpace(btcUtilization);
    const internalPoolCapital = this.calculateInternalPoolCapital();
    const maxPoolCapitalBn = BigNumber(totalPoolSpace).multipliedBy(this.rules.poolUtilizationPctMin / 100);
    const maxPoolCapital = bigIntMax(internalPoolCapital, bigNumberToBigInt(maxPoolCapitalBn));

    return maxPoolCapital - internalPoolCapital;
  }

  private calculateGlobalPoolCapital(btcUtilization: 'Low' | 'High', poolUtilization: 'Low' | 'High'): bigint {
    return this.epochPoolCapitalTotal + this.calculateTotalPoolCapital(btcUtilization, poolUtilization);
  }

  private calculateTotalPoolRevenue(btcUtilization: 'Low' | 'High', poolUtilization: 'Low' | 'High'): bigint {
    const totalPoolCapital = this.calculateTotalPoolCapital(btcUtilization, poolUtilization);
    const globalPoolCapital = this.calculateGlobalPoolCapital(btcUtilization, poolUtilization);
    const pctOfGlobalPool = BigNumber(totalPoolCapital).dividedBy(globalPoolCapital).toNumber();
    const epochRevenueFromPoolBn = BigNumber(this.epochPoolRewards).multipliedBy(pctOfGlobalPool);
    return bigNumberToBigInt(epochRevenueFromPoolBn);
  }

  private extractRulesFor(utilization: 'Low' | 'High' | 'Full') {
    if (utilization === 'Low') {
      return {
        btcUtilizationPct: this.rules.btcUtilizationPctMin,
      };
    } else if (utilization === 'High') {
      return {
        btcUtilizationPct: this.rules.btcUtilizationPctMax,
      };
    } else {
      return {
        btcUtilizationPct: 100,
      };
    }
  }
}
