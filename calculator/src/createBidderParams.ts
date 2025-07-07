import { type ArgonClient } from '@argonprotocol/mainchain';
import { type IBidderParams } from './IBidderParams.js';
import type IBiddingRules from './IBiddingRules.js';
import BiddingCalculator from './BiddingCalculator.js';
import BiddingCalculatorData from './BiddingCalculatorData.js';
import { Mainchain } from './Mainchain.ts';
import { BidAmountFormulaType, SeatGoalType } from './IBiddingRules.js';

export default async function createBidderParams(
  _cohortId: number,
  client: ArgonClient,
  biddingRules: IBiddingRules,
): Promise<IBidderParams> {
  const mainchain = new Mainchain(Promise.resolve(client));
  const helper = new Helper(biddingRules, mainchain);

  const minBid = await helper.calculateMinBid();
  const maxBid = await helper.calculateMaxBid();

  const maxSeats = await helper.getMaxSeats();
  const maxBudget = helper.getMaxBalance(maxBid * BigInt(maxSeats));
  const bidDelay = biddingRules.rebiddingDelay || 0;
  const bidIncrement = biddingRules.rebiddingIncrementBy || 1n;
  const bidderParams: IBidderParams = {
    minBid,
    maxBid,
    maxBudget,
    maxSeats,
    bidDelay,
    bidIncrement,
  };
  console.log('Bidder params', bidderParams);
  return bidderParams;
}

export class Helper {
  private readonly biddingRules: IBiddingRules;
  private readonly calculatorData: BiddingCalculatorData;
  private readonly startingMinimumCalculator: BiddingCalculator;
  private readonly startingOptimisticCalculator: BiddingCalculator;
  private readonly finalMinimumCalculator: BiddingCalculator;
  private readonly finalOptimisticCalculator: BiddingCalculator;

  constructor(biddingRules: IBiddingRules, mainchain: Mainchain) {
    this.biddingRules = biddingRules;
    this.calculatorData = new BiddingCalculatorData(mainchain);
    this.startingMinimumCalculator = new BiddingCalculator('Minimum', this.calculatorData);
    this.startingOptimisticCalculator = new BiddingCalculator('Optimistic', this.calculatorData);
    this.finalMinimumCalculator = new BiddingCalculator('Minimum', this.calculatorData);
    this.finalOptimisticCalculator = new BiddingCalculator('Optimistic', this.calculatorData);
  }

  public async getMaxSeats() {
    await this.calculatorData.isInitialized;

    let maxSeats = this.calculatorData.miningSeatCount / 10;

    if (this.biddingRules.seatGoalType === SeatGoalType.Max) {
      return this.biddingRules.seatGoalCount || 0;
    }

    return maxSeats;
  }

  public getMaxBalance(defaultMaxBalance: bigint): bigint {
    return defaultMaxBalance;
  }

  public async calculateMinBid(): Promise<bigint> {
    if (this.biddingRules.startingBidAmountFormulaType === 'Custom') {
      return this.biddingRules.startingBidAmountAbsolute;
    }

    await this.calculatorData.isInitialized;
    let formulaAmount = 0n;

    if (this.biddingRules.startingBidAmountFormulaType === BidAmountFormulaType.PreviousDayLow) {
      formulaAmount = this.calculatorData.previousDayLowBid;
    } else if (this.biddingRules.startingBidAmountFormulaType === BidAmountFormulaType.MinimumBreakeven) {
      formulaAmount = this.startingMinimumCalculator.minimumBreakevenBid;
    } else if (this.biddingRules.startingBidAmountFormulaType === BidAmountFormulaType.OptimisticBreakeven) {
      formulaAmount = this.startingOptimisticCalculator.optimisticBreakevenBid;
    }

    const minBid = formulaAmount * (1n + this.biddingRules.startingBidAmountAbsolute);

    return minBid;
  }

  public async calculateMaxBid(): Promise<bigint> {
    if (this.biddingRules.finalBidAmountFormulaType === 'Custom') {
      return this.biddingRules.finalBidAmountAbsolute;
    }

    await this.calculatorData.isInitialized;
    let formulaAmount = 0n;

    if (this.biddingRules.finalBidAmountFormulaType === BidAmountFormulaType.PreviousDayHigh) {
      formulaAmount = this.calculatorData.previousDayHighBid;
    } else if (this.biddingRules.finalBidAmountFormulaType === BidAmountFormulaType.MinimumBreakeven) {
      formulaAmount = this.finalMinimumCalculator.minimumBreakevenBid;
    } else if (this.biddingRules.finalBidAmountFormulaType === BidAmountFormulaType.OptimisticBreakeven) {
      formulaAmount = this.finalOptimisticCalculator.optimisticBreakevenBid;
    }

    const maxBid = formulaAmount * (1n + this.biddingRules.finalBidAmountAbsolute);

    return maxBid;
  }
}
