import BigNumber from 'bignumber.js';
import BiddingCalculatorData from './BiddingCalculatorData.js';
import { bigIntMax, bigIntMin, bigNumberToBigInt } from './utils.js';
import { BidAmountAdjustmentType, BidAmountFormulaType, type IBiddingRules } from './IBiddingRules.js';
import { MICROGONS_PER_ARGON } from './Mainchain.js';

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

  public minimumBidAmount!: bigint;
  public minimumBidAmountAtPivot: null | bigint = null;
  public minimumBidAmountFromMaximumBid: null | bigint = null;
  public minimumBidAmountFromExpectedGrowth: null | bigint = null;

  public maximumBidAmount!: bigint;
  public maximumBidAmountAtPivot: null | bigint = null;
  public maximumBidAmountFromMinimumBid: null | bigint = null;
  public maximumBidAmountFromExpectedGrowth: null | bigint = null;

  public minimumBidAtSlowGrowthAPY!: number;
  public minimumBidAtFastGrowthAPY!: number;

  public maximumBidAtSlowGrowthAPY!: number;
  public maximumBidAtFastGrowthAPY!: number;

  public averageAPY!: number;

  public pivotPoint: null | 'ExpectedGrowth' | 'MinimumBid' | 'MaximumBid' = null;

  public isInitializedPromise: Promise<void>;

  constructor(calculatorData: BiddingCalculatorData, biddingRules: IBiddingRules) {
    this.data = calculatorData;
    this.biddingRules = biddingRules;
    this.isInitializedPromise = this.data.isInitializedPromise
      .then(() => {
        this.calculateBidAmounts();
      })
      .catch(error => {
        console.error('Error initializing bidding calculator', error);
      });
  }

  public get minimumBidAmountOverride(): bigint | null {
    if (this.minimumBidAmountFromMaximumBid || this.minimumBidAmountFromExpectedGrowth) {
      return bigIntMin(this.minimumBidAmountFromMaximumBid, this.minimumBidAmountFromExpectedGrowth);
    }
    return null;
  }

  public get maximumBidAmountOverride(): bigint | null {
    if (this.maximumBidAmountFromMinimumBid || this.maximumBidAmountFromExpectedGrowth) {
      return bigIntMax(this.maximumBidAmountFromMinimumBid, this.maximumBidAmountFromExpectedGrowth);
    }
    return null;
  }

  public get slowGrowthRewards(): bigint {
    return this.calculateMinimumRewardsThisSeat();
  }

  public get fastGrowthRewards(): bigint {
    return this.calculateOptimisticRewardsThisSeat();
  }

  public async updateBiddingRules(biddingRules: IBiddingRules) {
    this.biddingRules = biddingRules;
  }

  public setPivotPoint(pivotPoint: null | 'ExpectedGrowth' | 'MinimumBid' | 'MaximumBid') {
    if (pivotPoint === 'ExpectedGrowth') {
      this.minimumBidAmountAtPivot = this.minimumBidAmountAtPivot || this.minimumBidAmount;
      this.maximumBidAmountAtPivot = this.maximumBidAmountAtPivot || this.maximumBidAmount;
    }
    this.pivotPoint = pivotPoint;
  }

  public calculateBidAmounts() {
    this.minimumBidAmount = this.calculateBidAmount('minimum');
    this.maximumBidAmount = this.calculateBidAmount('maximum');

    if (this.pivotPoint === 'MinimumBid') {
      if (this.minimumBidAmount > this.maximumBidAmount) {
        this.maximumBidAmountFromMinimumBid = this.minimumBidAmount;
      } else {
        this.maximumBidAmountFromMinimumBid = null;
      }
    } else if (this.pivotPoint === 'MaximumBid') {
      if (this.maximumBidAmount < this.minimumBidAmount) {
        this.minimumBidAmountFromMaximumBid = this.maximumBidAmount;
      } else {
        this.minimumBidAmountFromMaximumBid = null;
      }
    } else if (this.pivotPoint === 'ExpectedGrowth') {
      if (this.minimumBidAmountAtPivot !== this.minimumBidAmount) {
        this.minimumBidAmountFromExpectedGrowth = this.minimumBidAmountAtPivot;
      } else {
        this.minimumBidAmountFromExpectedGrowth = null;
      }
      if (this.maximumBidAmountAtPivot !== this.maximumBidAmount) {
        this.maximumBidAmountFromExpectedGrowth = this.maximumBidAmountAtPivot;
      } else {
        this.maximumBidAmountFromExpectedGrowth = null;
      }
    }

    this.minimumBidAtSlowGrowthAPY = this.calculateAPY('minimum', 'slow');
    this.minimumBidAtFastGrowthAPY = this.calculateAPY('minimum', 'fast');
    this.maximumBidAtSlowGrowthAPY = this.calculateAPY('maximum', 'slow');
    this.maximumBidAtFastGrowthAPY = this.calculateAPY('maximum', 'fast');

    this.averageAPY =
      (Math.min(this.minimumBidAtSlowGrowthAPY, 999_999) +
        Math.min(this.minimumBidAtFastGrowthAPY, 999_999) +
        Math.min(this.maximumBidAtSlowGrowthAPY, 999_999) +
        Math.min(this.maximumBidAtFastGrowthAPY, 999_999)) /
      4;
  }

  private calculateBidAmount(bidType: IBidType) {
    const bidDetails = this.extractBidDetails(bidType);
    const formulaPrice = this.calculateFormulaPrice(bidDetails);
    return this.adjustFormulaPrice(formulaPrice, bidDetails);
  }

  public get breakevenBidAtSlowGrowth(): bigint {
    const totalRewards = this.calculateMinimumRewardsThisSeat();
    const costOfArgonotBidLossInMicrogons = this.calculateCostOfArgonotBidLossInMicrogons(
      this.biddingRules.argonotPriceChangePctMin,
    );
    return totalRewards - (this.data.estimatedTransactionFee + costOfArgonotBidLossInMicrogons);
  }

  public get breakevenBidAtFastGrowth(): bigint {
    const optimisticRewards = this.calculateOptimisticRewardsThisSeat();
    const costOfArgonotBidLossInMicrogons = this.calculateCostOfArgonotBidLossInMicrogons(
      this.biddingRules.argonotPriceChangePctMax,
    );
    return optimisticRewards - (this.data.estimatedTransactionFee + costOfArgonotBidLossInMicrogons);
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
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Invalid price formula type: ${bidDetails.formulaType}`);
    }

    return price;
  }

  private adjustFormulaPrice(price: bigint, bidDetails: IBidDetails): bigint {
    if (bidDetails.formulaType === BidAmountFormulaType.Custom) {
      price = bidDetails.custom;
    } else if (bidDetails.adjustmentType === BidAmountAdjustmentType.Absolute) {
      price += bidDetails.adjustAbsolute;
    } else if (bidDetails.adjustmentType === BidAmountAdjustmentType.Relative) {
      const adjustmentAmountBn = BigNumber(price).multipliedBy(bidDetails.adjustRelative / 100);
      price += bigNumberToBigInt(adjustmentAmountBn);
    }

    return price;
  }

  private calculateCostOfArgonotBidLossInMicrogons(argonotPriceChangePct: number): bigint {
    const lossMultiplierBn = BigNumber(argonotPriceChangePct).dividedBy(100);
    const lossInMicronotsBn = BigNumber(-this.data.micronotsRequiredForBid).multipliedBy(lossMultiplierBn);
    const lossInMicrogons = this.micronotToMicrogon(bigNumberToBigInt(lossInMicronotsBn));
    return bigIntMax(0n, lossInMicrogons);
  }

  private calculateAPY(bidType: IBidType, growthType: IGrowthType): number {
    const minimumBidAmount = this.minimumBidAmountOverride ?? this.minimumBidAmount;
    const maximumBidAmount = this.maximumBidAmountOverride ?? this.maximumBidAmount;
    const microgonsBid = bidType === 'minimum' ? minimumBidAmount : maximumBidAmount;

    const transactionFee = this.data.estimatedTransactionFee;

    const argonotPriceChangePct = this.extractArgonotPriceChangePct(growthType);
    const argonCirculationGrowthPct = this.extractArgonCirculationGrowthPct(growthType);

    const costOfArgonotBidLossInMicrogons = this.calculateCostOfArgonotBidLossInMicrogons(argonotPriceChangePct);
    const totalCostBn = BigNumber(microgonsBid + transactionFee + costOfArgonotBidLossInMicrogons);

    const microgonsToMine = this.data.microgonsToMineThisSeat;
    const microgonsToMint = this.calculateMicrogonsToMintThisSeat(argonCirculationGrowthPct);

    const micronotsMinedAsMicrogons = this.micronotMinedAsMicrogonValue(argonotPriceChangePct);
    const totalRewardsBn = BigNumber(microgonsToMine + micronotsMinedAsMicrogons + microgonsToMint);

    let totalPercentReturn = totalRewardsBn.minus(totalCostBn).dividedBy(totalCostBn).multipliedBy(100).toNumber();

    if (totalPercentReturn < 1000) {
      totalPercentReturn = Math.round(totalPercentReturn * 100) / 100;
    } else {
      totalPercentReturn = Math.round(totalPercentReturn);
    }
    totalPercentReturn = Math.max(totalPercentReturn, -100);

    const apy = Math.pow(1 + totalPercentReturn / 100, 36.5) * 100 - 100;

    return Math.max(apy, -100);
  }

  private calculateMinimumRewardsThisSeat(): bigint {
    const microgonsToMine = this.data.microgonsToMineThisSeat;
    const microgonsToMint = this.calculateMicrogonsToMintThisSeat(this.biddingRules.argonCirculationGrowthPctMin);
    const micronotsMinedAsMicrogons = this.micronotMinedAsMicrogonValue(this.biddingRules.argonotPriceChangePctMin);

    return microgonsToMine + microgonsToMint + micronotsMinedAsMicrogons;
  }

  private calculateOptimisticRewardsThisSeat(): bigint {
    const microgonsToMine = this.data.microgonsToMineThisSeat;
    const microgonsToMint = this.calculateMicrogonsToMintThisSeat(this.biddingRules.argonCirculationGrowthPctMax);
    const micronotsMinedAsMicrogons = this.micronotMinedAsMicrogonValue(this.biddingRules.argonotPriceChangePctMax);
    return microgonsToMine + micronotsMinedAsMicrogons + microgonsToMint;
  }

  private micronotMinedAsMicrogonValue(argonotPriceChangePct: number): bigint {
    const tenDayPriceChangePct = this.convertAnnualToTenDayRate(argonotPriceChangePct);
    const micronots = this.data.micronotsToMineThisSeat;
    const asMicrogons = this.micronotToMicrogon(micronots);
    const priceChangeMultiplierBn = BigNumber(1 + tenDayPriceChangePct / 100);
    const microgonValueBn = BigNumber(asMicrogons).multipliedBy(priceChangeMultiplierBn);
    return bigNumberToBigInt(microgonValueBn);
  }

  private calculateMicrogonsToMintThisSeat(argonCirculationGrowthPct: number): bigint {
    if (!argonCirculationGrowthPct) return 0n;

    const tenDayCirculationGrowthPct = this.convertAnnualToTenDayRate(argonCirculationGrowthPct);
    const microgonsInCirculation = this.data.microgonsInCirculation;
    // Convert annual growth rate to 10-day growth rate by taking the 36.5th root
    // Use Math.pow for decimal exponents since BigNumber.pow only accepts integers
    const annualMultiplier = 1 + tenDayCirculationGrowthPct / 100;
    const epochMultiplier = Math.pow(annualMultiplier, 1 / 36.5);

    const microgonsToMintThisEpochBn = BigNumber(microgonsInCirculation).multipliedBy(epochMultiplier - 1);
    const microgonsToMintThisSeatBn =
      this.data.maxPossibleMiningSeatCount === 0
        ? BigNumber(0)
        : microgonsToMintThisEpochBn.dividedBy(this.data.maxPossibleMiningSeatCount);
    return bigNumberToBigInt(microgonsToMintThisSeatBn);
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
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
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
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
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
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Invalid growth type: ${growthType}`);
    }
  }

  private convertAnnualToTenDayRate(annualPct: number): number {
    if (annualPct < -100) {
      throw new RangeError('annualPct cannot go lower than -100');
    }

    const annualFactor = 1 + annualPct / 100;
    const periodsPerYear = 365 / 10;
    const rate = Math.pow(annualFactor, 1 / periodsPerYear) - 1;

    return rate * 100;
  }
}
