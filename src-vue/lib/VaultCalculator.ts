import BigNumber from 'bignumber.js';
import { bigNumberToBigInt, MainchainClients, PriceIndex } from '@argonprotocol/commander-core';
import { Config } from './Config';
import { calculateAPY } from './Utils';
import { bigIntMax } from '@argonprotocol/commander-core/src/utils';
import { Vaults } from './Vaults.ts';

export class VaultCalculator {
  private rules!: Config['vaultingRules'];
  private readonly clients: MainchainClients;

  private totalPoolRewards!: bigint;
  private existingPoolCapital!: bigint;

  constructor(mainchainClients: MainchainClients) {
    this.clients = mainchainClients;
  }

  async load(rules: Config['vaultingRules']) {
    this.rules = rules;
    const { totalPoolRewards, totalActivatedCapital } = await Vaults.getLiquidityPoolPayout(this.clients);
    this.totalPoolRewards = totalPoolRewards;
    this.existingPoolCapital = totalActivatedCapital;
  }

  public calculateInternalAPY(utilization: 'Low' | 'High'): number {
    const vaultRevenue = this.calculateInternalRevenue(utilization);
    const vaultCost = this.rules.baseMicrogonCommitment;

    return calculateAPY(vaultCost, vaultCost + vaultRevenue);
  }

  public calculateInternalRevenue(utilization: 'Low' | 'High'): bigint {
    const { profitSharingPct } = this.rules;

    const totalPoolCapital = this.calculateTotalPoolCapital(utilization);
    const totalPoolRevenue = this.calculateTotalPoolRevenue(utilization);
    const internalBtcRevenue = this.calculateInternalBtcRevenue(utilization);

    const externalPoolCapital = this.calculateExternalPoolCapital(utilization);

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

  public calculateExternalAPY(utilization: 'Low' | 'High'): number {
    const { profitSharingPct } = this.rules;
    const totalPoolCapital = this.calculateTotalPoolCapital(utilization);
    const externalPoolCapital = this.calculateExternalPoolCapital(utilization);

    const externalFactorBn = totalPoolCapital
      ? BigNumber(externalPoolCapital).dividedBy(totalPoolCapital)
      : BigNumber(0);

    const totalPoolRevenue = this.calculateTotalPoolRevenue(utilization);

    const externalPoolRevenueBn = BigNumber(totalPoolRevenue)
      .multipliedBy(externalFactorBn)
      .multipliedBy(profitSharingPct / 100);
    const externalPoolRevenue = bigNumberToBigInt(externalPoolRevenueBn);

    return calculateAPY(externalPoolCapital, externalPoolCapital + externalPoolRevenue);
  }

  public calculateBtcSpaceInMicrogons(): bigint {
    // this function has no utilization parameter because BTC space is only dependent on pool capital
    const { baseMicrogonCommitment: vaultCapital, capitalForSecuritizationPct, securitizationRatio } = this.rules;

    const vaultCapitalBn = BigNumber(vaultCapital);
    const btcSecuritizationBn = vaultCapitalBn.multipliedBy(capitalForSecuritizationPct / 100);
    const btcSpaceInMicrogonsBn = btcSecuritizationBn.dividedBy(securitizationRatio);

    return bigNumberToBigInt(btcSpaceInMicrogonsBn);
  }

  private calculateBtcUtilizedInMicrogons(utilization: 'Low' | 'High'): bigint {
    const { btcUtilizationPct } = this.extractRulesFor(utilization);
    const btcSpaceInMicrogons = this.calculateBtcSpaceInMicrogons();
    const btcUtilizedInMicrogonsBn = BigNumber(btcSpaceInMicrogons).multipliedBy(btcUtilizationPct / 100);
    const btcUtilizedInMicrogons = bigNumberToBigInt(btcUtilizedInMicrogonsBn);

    return bigIntMax(btcUtilizedInMicrogons, this.rules.personalBtcInMicrogons);
  }

  private calculateInternalBtcRevenue(utilization: 'Low' | 'High'): bigint {
    const { personalBtcInMicrogons } = this.rules;
    const btcUtilizedInMicrogons = this.calculateBtcUtilizedInMicrogons(utilization);
    const btcSellableInMicrogons = BigNumber(btcUtilizedInMicrogons).minus(personalBtcInMicrogons).toNumber();

    let totalRevenueFromBtcBn = BigNumber(btcSellableInMicrogons).multipliedBy(this.rules.btcPctFee / 100);
    if (btcSellableInMicrogons > 0n) {
      // TODO: this assumes all the BTC space is taken in a single transaction. We need a more sophisticated model for this.
      totalRevenueFromBtcBn = totalRevenueFromBtcBn.plus(this.rules.btcFlatFee);
    }

    const appliedRevenueFromBtc = bigNumberToBigInt(totalRevenueFromBtcBn.dividedBy(36.5));
    return appliedRevenueFromBtc;
  }

  public calculateTotalPoolSpace(utilization: 'Low' | 'High'): bigint {
    // Ultimately the pool space is dependent on how much BTC is in the vault
    const btcUtilizedInMicrogons = this.calculateBtcUtilizedInMicrogons(utilization);

    return bigIntMax(btcUtilizedInMicrogons, this.rules.personalBtcInMicrogons);
  }

  private calculateTotalPoolCapital(utilization: 'Low' | 'High'): bigint {
    const totalPoolSpace = this.calculateTotalPoolSpace(utilization);
    const maxPoolCapitalBn = BigNumber(totalPoolSpace).multipliedBy(this.rules.poolUtilizationPctMin / 100);
    const maxPoolCapital = bigNumberToBigInt(maxPoolCapitalBn);
    const internalPoolCapital = this.caculateInternalPoolCapital();

    return bigIntMax(internalPoolCapital, maxPoolCapital);
  }

  private caculateInternalPoolCapital(): bigint {
    const { baseMicrogonCommitment: internalCapital, capitalForLiquidityPct } = this.rules;

    const internalCapitalBn = BigNumber(internalCapital);
    const internalPoolCapitalBn = internalCapitalBn.multipliedBy(capitalForLiquidityPct / 100);
    return bigNumberToBigInt(internalPoolCapitalBn);
  }

  public calculateExternalPoolCapital(utilization: 'Low' | 'High'): bigint {
    const totalPoolSpace = this.calculateTotalPoolSpace(utilization);
    const internalPoolCapital = this.caculateInternalPoolCapital();
    const maxPoolCapitalBn = BigNumber(totalPoolSpace).multipliedBy(this.rules.poolUtilizationPctMin / 100);
    const maxPoolCapital = bigIntMax(internalPoolCapital, bigNumberToBigInt(maxPoolCapitalBn));

    return maxPoolCapital - internalPoolCapital;
  }

  private calculateGobalPoolCapital(utilization: 'Low' | 'High'): bigint {
    return this.existingPoolCapital + this.calculateTotalPoolCapital(utilization);
  }

  private calculateTotalPoolRevenue(utilization: 'Low' | 'High'): bigint {
    const totalPoolCapital = this.calculateTotalPoolCapital(utilization);
    const globalPoolCapital = this.calculateGobalPoolCapital(utilization);
    const pctOfGlobalPool = BigNumber(totalPoolCapital).dividedBy(globalPoolCapital).toNumber();
    const revenueFromPoolBn = BigNumber(this.totalPoolRewards).multipliedBy(pctOfGlobalPool);
    return bigNumberToBigInt(revenueFromPoolBn);
  }

  private extractRulesFor(utilization: 'Low' | 'High') {
    if (utilization === 'Low') {
      return {
        btcUtilizationPct: this.rules.btcUtilizationPctMin,
      };
    } else {
      return {
        btcUtilizationPct: this.rules.btcUtilizationPctMax,
      };
    }
  }
}
