import BiddingCalculatorData from './BiddingCalculatorData.js';
import { bigIntMax, bigIntMultiplyNumber } from './utils.js';
import BigNumber from 'bignumber.js';
import { MICROGONS_PER_ARGON } from './Mainchain.ts';
import { BidAmountAdjustmentType, BidAmountFormulaType } from './IBiddingRules.ts';
import { MICRONOTS_PER_ARGONOT } from '../../src-vue/lib/Currency.ts';

export interface IBidAmount {
  formulaType: BidAmountFormulaType;
  adjustmentType: BidAmountAdjustmentType;
  absolute: bigint;
  relative: number;
}

export default class BiddingCalculator {
  public microgonBidPremium: bigint = 0n;
  public microgonsToMintThisSeat: bigint = 0n;

  private data: BiddingCalculatorData;

  public argonCirculationGrowthPctMin: number = 0;
  public argonCirculationGrowthPctMax: number = 0;

  public micronotPriceChangePctMin: number = 0;
  public micronotPriceChangePctMax: number = 0;

  public startingBidAmount: IBidAmount = {
    formulaType: BidAmountFormulaType.MinimumBreakeven,
    adjustmentType: BidAmountAdjustmentType.Absolute,
    absolute: 0n,
    relative: 0,
  };
  public finalBidAmount: IBidAmount = {
    formulaType: BidAmountFormulaType.MinimumBreakeven,
    adjustmentType: BidAmountAdjustmentType.Absolute,
    absolute: 0n,
    relative: 0,
  };

  constructor(calculatorData: BiddingCalculatorData) {
    this.data = calculatorData;
  }

  public async setConfig(config: {
    argonCirculationGrowthPctMin: number;
    argonCirculationGrowthPctMax: number;
    micronotPriceChangePctMin: number;
    micronotPriceChangePctMax: number;
    startingBidAmount: IBidAmount;
    finalBidAmount: IBidAmount;
  }) {
    this.argonCirculationGrowthPctMin = config.argonCirculationGrowthPctMin;
    this.argonCirculationGrowthPctMax = config.argonCirculationGrowthPctMax;
    this.micronotPriceChangePctMin = config.micronotPriceChangePctMin;
    this.micronotPriceChangePctMax = config.micronotPriceChangePctMax;
    this.startingBidAmount = config.startingBidAmount;
    this.finalBidAmount = config.finalBidAmount;
  }

  public get startingBid(): bigint {
    let startingBid = 0n;
    const formulaPrice = this.calculateFormulaPrice(this.startingBidAmount);
    if (this.startingBidAmount.formulaType === BidAmountFormulaType.Custom) {
      startingBid = formulaPrice;
    } else if (this.startingBidAmount.adjustmentType === BidAmountAdjustmentType.Absolute) {
      startingBid = formulaPrice + this.startingBidAmount.absolute;
    } else if (this.startingBidAmount.adjustmentType === BidAmountAdjustmentType.Relative) {
      startingBid = bigIntMultiplyNumber(formulaPrice, 1 + this.startingBidAmount.relative / 100);
    }
    return startingBid;
  }

  public get finalBid(): bigint {
    let finalBid = 0n;
    const formulaPrice = this.calculateFormulaPrice(this.finalBidAmount);
    if (this.finalBidAmount.adjustmentType === BidAmountAdjustmentType.Absolute) {
      finalBid = formulaPrice + this.finalBidAmount.absolute;
    } else if (this.finalBidAmount.adjustmentType === BidAmountAdjustmentType.Relative) {
      finalBid = bigIntMultiplyNumber(formulaPrice, 1 + this.finalBidAmount.relative / 100);
    }
    return finalBid;
  }

  public get minimumTDPR(): number {
    return this.calculateTDPR('minimum');
  }

  public get optimisticTDPR(): number {
    return this.calculateTDPR('optimistic');
  }

  public get minimumAPR(): number {
    return this.calculateAPR('minimum');
  }

  public get optimisticAPR(): number {
    return this.calculateAPR('optimistic');
  }

  public get minimumAPY(): number {
    return this.calculateAPY('minimum');
  }

  public get optimisticAPY(): number {
    return this.calculateAPY('optimistic');
  }

  public get minimumBreakevenBid(): bigint {
    const totalRewards = this.calculateMinRewardsThisSeat();
    const costOfArgonotLossInMicrogons = this.calculateCostOfArgonotLossInMicrogons(this.micronotPriceChangePctMin);
    return totalRewards - (this.data.estimatedTransactionFee + costOfArgonotLossInMicrogons);
  }

  public get optimisticBreakevenBid(): bigint {
    const optimisticRewards = this.calculateOptimisticRewardsThisSeat();
    const costOfArgonotLossInMicrogons = this.calculateCostOfArgonotLossInMicrogons(this.micronotPriceChangePctMax);
    return optimisticRewards - (this.data.estimatedTransactionFee + costOfArgonotLossInMicrogons);
  }

  private calculateFormulaPrice(bidAmount: IBidAmount): bigint {
    if (bidAmount.formulaType === BidAmountFormulaType.PreviousDayHigh) {
      return this.data.previousDayHighBid;
    } else if (bidAmount.formulaType === BidAmountFormulaType.PreviousDayLow) {
      return this.data.previousDayLowBid;
    } else if (bidAmount.formulaType === BidAmountFormulaType.PreviousDayMid) {
      return this.data.previousDayMidBid;
    } else if (bidAmount.formulaType === BidAmountFormulaType.MinimumBreakeven) {
      return this.minimumBreakevenBid;
    } else if (bidAmount.formulaType === BidAmountFormulaType.OptimisticBreakeven) {
      return this.optimisticBreakevenBid;
    } else if (bidAmount.formulaType === BidAmountFormulaType.RelativeBreakeven) {
      return (this.optimisticBreakevenBid + this.minimumBreakevenBid) / 2n;
    } else if (bidAmount.formulaType === BidAmountFormulaType.Custom) {
      return bidAmount.absolute;
    } else {
      throw new Error(`Invalid price formula type: ${bidAmount.formulaType}`);
    }
  }

  private calculateCostOfArgonotLossInMicrogons(argonotPriceChangePct: number): bigint {
    const lossMultiplier = BigInt(Math.floor(argonotPriceChangePct * (MICROGONS_PER_ARGON / 100)));
    const lossInMicronots = -(this.data.micronotsRequiredForBid * lossMultiplier);
    const lossInMicrogons = this.micronotToMicrogon(lossInMicronots);
    return bigIntMax(0n, lossInMicrogons);
  }

  private calculateTDPR(type: 'minimum' | 'optimistic') {
    const isMinimum = type === 'minimum';
    const microgonsBid = isMinimum ? this.finalBid : this.startingBid;
    const transactionFee = this.data.estimatedTransactionFee;
    const costOfArgonotLossInMicrogons = this.calculateCostOfArgonotLossInMicrogons(
      isMinimum ? this.micronotPriceChangePctMin : this.micronotPriceChangePctMax,
    );
    const totalCost = BigNumber(microgonsBid + transactionFee + costOfArgonotLossInMicrogons);

    const microgonsToMine = this.data.microgonsToMineThisSeat;
    const microgonsToMint = this.calculateMicrogonsToMintThisSeat(
      isMinimum ? this.argonCirculationGrowthPctMin : this.argonCirculationGrowthPctMax,
    );
    const micronotsMinedAsMicrogons = this.micronotMinedAsMicrogonValue(
      isMinimum ? this.micronotPriceChangePctMin : this.micronotPriceChangePctMax,
    );
    const totalRewards = BigNumber(microgonsToMine + micronotsMinedAsMicrogons + microgonsToMint);

    let tdpr = totalRewards.minus(totalCost).dividedBy(totalCost).multipliedBy(100).toNumber();

    if (tdpr < 1000) {
      tdpr = Math.round(tdpr * 100) / 100;
    } else {
      tdpr = Math.round(tdpr);
    }
    return Math.max(tdpr, -100);
  }

  private calculateAPR(type: 'minimum' | 'optimistic') {
    let apr = this.calculateTDPR(type) * 36.5;
    if (apr < 1000) {
      apr = Math.round(apr * 100) / 100;
    } else {
      apr = Math.round(apr);
    }
    return Math.max(apr, -100);
  }

  private calculateAPY(type: 'minimum' | 'optimistic') {
    const apy = Math.pow(1 + this.calculateTDPR(type) / 100, 36.5) * 100 - 100;
    return Math.max(apy, -100);
  }

  private calculateMinRewardsThisSeat(): bigint {
    const microgonsToMine = this.data.microgonsToMineThisSeat;
    const microgonsToMint = this.calculateMicrogonsToMintThisSeat(this.argonCirculationGrowthPctMin);
    const micronotsMinedAsMicrogons = this.micronotMinedAsMicrogonValue(this.micronotPriceChangePctMin);

    return microgonsToMine + microgonsToMint + micronotsMinedAsMicrogons;
  }

  private calculateOptimisticRewardsThisSeat(): bigint {
    const micronotsMinedAsMicrogons = this.micronotMinedAsMicrogonValue(this.micronotPriceChangePctMax);
    const microgonsToMine = this.data.microgonsToMineThisSeat;
    const microgonsToMint = this.calculateMicrogonsToMintThisSeat(this.argonCirculationGrowthPctMax);
    return microgonsToMine + micronotsMinedAsMicrogons + microgonsToMint;
  }

  private micronotMinedAsMicrogonValue(micronotPriceChangePct: number): bigint {
    const micronots = this.data.micronotsToMineThisSeat;
    const asMicrogons = this.micronotToMicrogon(micronots);
    const priceChangeMultiplier = 1 + micronotPriceChangePct / 100;
    return bigIntMultiplyNumber(asMicrogons, priceChangeMultiplier);
  }

  private calculateMicrogonsToMintThisSeat(argonCirculationGrowthPct: number): bigint {
    if (!argonCirculationGrowthPct) return 0n;

    const microgonsInCirculation = this.data.microgonsInCirculation;
    const growthPctDuringSeat = BigNumber(argonCirculationGrowthPct).dividedBy(36.5);
    const microgonsToMint = BigInt(
      BigNumber(microgonsInCirculation).multipliedBy(growthPctDuringSeat).integerValue().toString(),
    );
    return microgonsToMint;
  }

  private micronotToMicrogon(micronots: bigint): bigint {
    if (!micronots) return 0n;
    const argonotsBn = BigNumber(micronots).dividedBy(MICRONOTS_PER_ARGONOT);
    const microgonsBn = argonotsBn.multipliedBy(this.data.microgonExchangeRateTo.ARGNOT);
    return BigInt(Math.round(microgonsBn.toNumber()));
  }
}
