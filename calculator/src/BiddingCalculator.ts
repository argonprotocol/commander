import BiddingCalculatorData from './BiddingCalculatorData.js';
import { bigIntMax, bigIntMin, bigIntMultiplyNumber } from './utils.js';
import BigNumber from 'bignumber.js';
import { BidAmountAdjustmentType, BidAmountFormulaType, IBiddingRules } from './IBiddingRules.ts';
import { MICROGONS_PER_ARGON } from '@argonprotocol/commander-calculator/src/Mainchain';

const MICRONOTS_PER_ARGONOT = MICROGONS_PER_ARGON;

interface IBidDetails {
  formulaType: BidAmountFormulaType;
  adjustmentType: BidAmountAdjustmentType;
  adjustAbsolute: bigint;
  adjustRelative: number;
  custom: bigint;
}

type IBidType = 'minimum' | 'maximum';
type IGrowthType = 'slow' | 'medium' | 'fast';

export default class BiddingCalculator {
  public data: BiddingCalculatorData;

  public biddingRules: IBiddingRules;

  constructor(calculatorData: BiddingCalculatorData, biddingRules: IBiddingRules) {
    this.data = calculatorData;
    this.biddingRules = biddingRules;
  }

  public get isInitialized(): Promise<void> {
    return this.data.isInitialized;
  }

  public async updateBiddingRules(biddingRules: IBiddingRules) {
    this.biddingRules = biddingRules;
  }

  public get minimumBidAmount(): bigint {
    const minimumBidDetails = this.extractBidDetails('minimum');
    const minimumBidAmount = this.calculateFormulaPrice(minimumBidDetails);
    return bigIntMin(minimumBidAmount, this.maximumBidAmount);
  }

  public get maximumBidAmount(): bigint {
    const maximumBidDetails = this.extractBidDetails('maximum');
    return this.calculateFormulaPrice(maximumBidDetails);
  }

  public get minimumBidAtSlowGrowthAPY(): number {
    return this.calculateAPY('minimum', 'slow');
  }

  public get minimumBidAtFastGrowthAPY(): number {
    return this.calculateAPY('minimum', 'fast');
  }

  public get maximumBidAtSlowGrowthAPY(): number {
    return this.calculateAPY('maximum', 'slow');
  }

  public get maximumBidAtFastGrowthAPY(): number {
    const apy = this.calculateAPY('maximum', 'fast');
    return apy;
  }

  public get breakevenBidAtSlowGrowth(): bigint {
    const totalRewards = this.calculateMinRewardsThisSeat();
    const costOfArgonotLossInMicrogons = this.calculateCostOfArgonotLossInMicrogons(
      this.biddingRules.argonotPriceChangePctMin,
    );
    return totalRewards - (this.data.estimatedTransactionFee + costOfArgonotLossInMicrogons);
  }

  public get breakevenBidAtFastGrowth(): bigint {
    const optimisticRewards = this.calculateOptimisticRewardsThisSeat();
    const costOfArgonotLossInMicrogons = this.calculateCostOfArgonotLossInMicrogons(
      this.biddingRules.argonotPriceChangePctMax,
    );
    return optimisticRewards - (this.data.estimatedTransactionFee + costOfArgonotLossInMicrogons);
  }

  public get breakevenBidAtMediumGrowth(): bigint {
    return (this.breakevenBidAtFastGrowth + this.breakevenBidAtSlowGrowth) / 2n;
  }

  private calculateFormulaPrice(bidDetails: IBidDetails): bigint {
    let price = 0n;

    if (bidDetails.formulaType === BidAmountFormulaType.PreviousDayHigh) {
      price = this.data.previousDayHighBid;
    } else if (bidDetails.formulaType === BidAmountFormulaType.PreviousDayLow) {
      price = this.data.previousDayLowBid;
    } else if (bidDetails.formulaType === BidAmountFormulaType.PreviousDayMid) {
      price = this.data.previousDayMidBid;
    } else if (bidDetails.formulaType === BidAmountFormulaType.BreakevenAtSlowGrowth) {
      price = this.breakevenBidAtSlowGrowth;
    } else if (bidDetails.formulaType === BidAmountFormulaType.BreakevenAtFastGrowth) {
      price = this.breakevenBidAtFastGrowth;
    } else if (bidDetails.formulaType === BidAmountFormulaType.BreakevenAtMediumGrowth) {
      price = this.breakevenBidAtMediumGrowth;
    } else if (bidDetails.formulaType !== BidAmountFormulaType.Custom) {
      throw new Error(`Invalid price formula type: ${bidDetails.formulaType}`);
    }

    if (bidDetails.formulaType === BidAmountFormulaType.Custom) {
      price = bidDetails.custom;
    } else if (bidDetails.adjustmentType === BidAmountAdjustmentType.Absolute) {
      price += bidDetails.adjustAbsolute;
    } else if (bidDetails.adjustmentType === BidAmountAdjustmentType.Relative) {
      price += bigIntMultiplyNumber(price, bidDetails.adjustRelative / 100);
    }

    return price;
  }

  private calculateCostOfArgonotLossInMicrogons(argonotPriceChangePct: number): bigint {
    const lossMultiplier = BigInt(Math.floor(argonotPriceChangePct * (MICROGONS_PER_ARGON / 100)));
    const lossInMicronots = -(this.data.micronotsRequiredForBid * lossMultiplier);
    const lossInMicrogons = this.micronotToMicrogon(lossInMicronots);
    return bigIntMax(0n, lossInMicrogons);
  }

  private calculateAPY(bidType: IBidType, growthType: IGrowthType): number {
    const microgonsBid = bidType === 'minimum' ? this.minimumBidAmount : this.maximumBidAmount;
    const transactionFee = this.data.estimatedTransactionFee;

    const argonotPriceChangePct = this.extractArgonotPriceChangePct(growthType);
    const argonCirculationGrowthPct = this.extractArgonCirculationGrowthPct(growthType);

    const costOfArgonotLossInMicrogons = this.calculateCostOfArgonotLossInMicrogons(argonotPriceChangePct);
    const totalCostBn = BigNumber(microgonsBid + transactionFee + costOfArgonotLossInMicrogons);

    const microgonsToMine = this.data.microgonsToMineThisSeat;
    const microgonsToMint = this.calculateMicrogonsToMintThisSeat(argonCirculationGrowthPct);

    const micronotsMinedAsMicrogons = this.micronotMinedAsMicrogonValue(argonotPriceChangePct);
    const totalRewardsBn = BigNumber(microgonsToMine + micronotsMinedAsMicrogons + microgonsToMint);

    let tdpr = totalRewardsBn.minus(totalCostBn).dividedBy(totalCostBn).multipliedBy(100).toNumber();

    if (tdpr < 1000) {
      tdpr = Math.round(tdpr * 100) / 100;
    } else {
      tdpr = Math.round(tdpr);
    }
    tdpr = Math.max(tdpr, -100);

    const apy = Math.pow(1 + tdpr / 100, 36.5) * 100 - 100;

    return Math.max(apy, -100);
  }

  private calculateMinRewardsThisSeat(): bigint {
    const microgonsToMine = this.data.microgonsToMineThisSeat;
    const microgonsToMint = this.calculateMicrogonsToMintThisSeat(this.biddingRules.argonCirculationGrowthPctMin);
    const micronotsMinedAsMicrogons = this.micronotMinedAsMicrogonValue(this.biddingRules.argonotPriceChangePctMin);

    return microgonsToMine + microgonsToMint + micronotsMinedAsMicrogons;
  }

  private calculateOptimisticRewardsThisSeat(): bigint {
    const micronotsMinedAsMicrogons = this.micronotMinedAsMicrogonValue(this.biddingRules.argonotPriceChangePctMax);
    const microgonsToMine = this.data.microgonsToMineThisSeat;
    const microgonsToMint = this.calculateMicrogonsToMintThisSeat(this.biddingRules.argonCirculationGrowthPctMax);
    return microgonsToMine + micronotsMinedAsMicrogons + microgonsToMint;
  }

  private micronotMinedAsMicrogonValue(argonotPriceChangePct: number): bigint {
    const micronots = this.data.micronotsToMineThisSeat;
    const asMicrogons = this.micronotToMicrogon(micronots);
    const priceChangeMultiplier = 1 + argonotPriceChangePct / 100;
    return bigIntMultiplyNumber(asMicrogons, priceChangeMultiplier);
  }

  private calculateMicrogonsToMintThisSeat(argonCirculationGrowthPct: number): bigint {
    if (!argonCirculationGrowthPct) return 0n;

    const microgonsInCirculation = this.data.microgonsInCirculation;
    // Convert annual growth rate to 10-day growth rate by taking the 36.5th root
    // Use Math.pow for decimal exponents since BigNumber.pow only accepts integers
    const annualMultiplier = 1 + argonCirculationGrowthPct / 100;
    const epochMultiplier = Math.pow(annualMultiplier, 1 / 36.5);

    const microgonsToMintThisEpochBn = BigNumber(microgonsInCirculation).multipliedBy(epochMultiplier - 1);
    const microgonsToMintThisSeatBn = microgonsToMintThisEpochBn.dividedBy(this.data.miningSeatCount);
    const microgonsToMintThisSeat = BigInt(microgonsToMintThisSeatBn.integerValue().toString());

    return microgonsToMintThisSeat;
  }

  private micronotToMicrogon(micronots: bigint): bigint {
    if (!micronots) return 0n;
    const argonotsBn = BigNumber(micronots).dividedBy(MICRONOTS_PER_ARGONOT);
    const microgonsBn = argonotsBn.multipliedBy(this.data.microgonExchangeRateTo.ARGNOT);
    return BigInt(Math.round(microgonsBn.toNumber()));
  }

  private extractBidDetails(bidType: IBidType): IBidDetails {
    if (bidType === 'minimum') {
      return {
        formulaType: this.biddingRules.minimumBidFormulaType,
        adjustmentType: this.biddingRules.minimumBidAdjustmentType,
        adjustAbsolute: this.biddingRules.minimumBidAdjustAbsolute,
        adjustRelative: this.biddingRules.minimumBidAdjustRelative,
        custom: this.biddingRules.minimumBidCustom,
      };
    } else if (bidType === 'maximum') {
      return {
        formulaType: this.biddingRules.maximumBidFormulaType,
        adjustmentType: this.biddingRules.maximumBidAdjustmentType,
        adjustAbsolute: this.biddingRules.maximumBidAdjustAbsolute,
        adjustRelative: this.biddingRules.maximumBidAdjustRelative,
        custom: this.biddingRules.maximumBidCustom,
      };
    } else {
      throw new Error(`Invalid bid type: ${bidType}`);
    }
  }

  private extractArgonotPriceChangePct(growthType: IGrowthType): number {
    if (growthType === 'slow') {
      return this.biddingRules.argonotPriceChangePctMin;
    } else if (growthType === 'fast') {
      return this.biddingRules.argonotPriceChangePctMax;
    } else if (growthType === 'medium') {
      return BigNumber(this.biddingRules.argonotPriceChangePctMin)
        .plus(this.biddingRules.argonotPriceChangePctMax)
        .dividedBy(2)
        .toNumber();
    } else {
      throw new Error(`Invalid growth type: ${growthType}`);
    }
  }

  private extractArgonCirculationGrowthPct(growthType: IGrowthType): number {
    if (growthType === 'slow') {
      return this.biddingRules.argonCirculationGrowthPctMin;
    } else if (growthType === 'fast') {
      return this.biddingRules.argonCirculationGrowthPctMax;
    } else if (growthType === 'medium') {
      return BigNumber(this.biddingRules.argonCirculationGrowthPctMin)
        .plus(this.biddingRules.argonCirculationGrowthPctMax)
        .dividedBy(2)
        .toNumber();
    } else {
      throw new Error(`Invalid growth type: ${growthType}`);
    }
  }
}
