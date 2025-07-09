import BiddingCalculatorData from './BiddingCalculatorData.js';
import { bigIntMax, bigIntMin, bigIntMultiplyNumber } from './utils.js';
import BigNumber from 'bignumber.js';
import { MICROGONS_PER_ARGON } from './Mainchain.ts';
import { BidAmountAdjustmentType, BidAmountFormulaType } from './IBiddingRules.ts';
import { MICRONOTS_PER_ARGONOT } from '../../src-vue/lib/Currency.ts';

export interface IBidAmount {
  formulaType: BidAmountFormulaType;
  adjustmentType: BidAmountAdjustmentType;
  custom: bigint;
  absolute: bigint;
  relative: number;
}

export default class BiddingCalculator {
  public microgonBidPremium: bigint = 0n;
  public microgonsToMintThisSeat: bigint = 0n;

  public data: BiddingCalculatorData;

  public argonCirculationGrowthPctMin: number = 0;
  public argonCirculationGrowthPctMax: number = 0;

  public micronotPriceChangePctMin: number = 0;
  public micronotPriceChangePctMax: number = 0;

  public startingBidAmount: IBidAmount = {
    formulaType: BidAmountFormulaType.MinimumBreakeven,
    adjustmentType: BidAmountAdjustmentType.Absolute,
    custom: 0n,
    absolute: 0n,
    relative: 0,
  };
  public finalBidAmount: IBidAmount = {
    formulaType: BidAmountFormulaType.MinimumBreakeven,
    adjustmentType: BidAmountAdjustmentType.Absolute,
    custom: 0n,
    absolute: 0n,
    relative: 0,
  };

  constructor(calculatorData: BiddingCalculatorData) {
    this.data = calculatorData;
  }

  public get isInitialized(): Promise<void> {
    return this.data.isInitialized;
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
    const startingBid = this.calculateFormulaPrice(this.startingBidAmount);
    return bigIntMin(startingBid, this.finalBid);
  }

  public get finalBid(): bigint {
    const finalBid = this.calculateFormulaPrice(this.finalBidAmount);
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
    let price = 0n;

    if (bidAmount.formulaType === BidAmountFormulaType.PreviousDayHigh) {
      price = this.data.previousDayHighBid;
    } else if (bidAmount.formulaType === BidAmountFormulaType.PreviousDayLow) {
      price = this.data.previousDayLowBid;
    } else if (bidAmount.formulaType === BidAmountFormulaType.PreviousDayMid) {
      price = this.data.previousDayMidBid;
    } else if (bidAmount.formulaType === BidAmountFormulaType.MinimumBreakeven) {
      price = this.minimumBreakevenBid;
    } else if (bidAmount.formulaType === BidAmountFormulaType.OptimisticBreakeven) {
      price = this.optimisticBreakevenBid;
    } else if (bidAmount.formulaType === BidAmountFormulaType.RelativeBreakeven) {
      price = (this.optimisticBreakevenBid + this.minimumBreakevenBid) / 2n;
    } else if (bidAmount.formulaType !== BidAmountFormulaType.Custom) {
      throw new Error(`Invalid price formula type: ${bidAmount.formulaType}`);
    }

    if (bidAmount.formulaType === BidAmountFormulaType.Custom) {
      price = bidAmount.custom;
    } else if (bidAmount.adjustmentType === BidAmountAdjustmentType.Absolute) {
      price += bidAmount.absolute;
    } else if (bidAmount.adjustmentType === BidAmountAdjustmentType.Relative) {
      price += bigIntMultiplyNumber(price, bidAmount.relative / 100);
    }

    return price;
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
    // Convert annual growth rate to 10-day growth rate by taking the 36.5th root
    // Use Math.pow for decimal exponents since BigNumber.pow only accepts integers
    const annualMultiplier = 1 + argonCirculationGrowthPct / 100;
    const dailyMultiplier = Math.pow(annualMultiplier, 1 / 36.5);
    const growthPctDuringSeat = BigNumber(dailyMultiplier - 1).multipliedBy(100);

    const microgonsToMintBn = BigNumber(microgonsInCirculation).multipliedBy(growthPctDuringSeat).dividedBy(100);
    const microgonsToMint = BigInt(microgonsToMintBn.integerValue().toString());

    return microgonsToMint;
  }

  private micronotToMicrogon(micronots: bigint): bigint {
    if (!micronots) return 0n;
    const argonotsBn = BigNumber(micronots).dividedBy(MICRONOTS_PER_ARGONOT);
    const microgonsBn = argonotsBn.multipliedBy(this.data.microgonExchangeRateTo.ARGNOT);
    return BigInt(Math.round(microgonsBn.toNumber()));
  }
}
