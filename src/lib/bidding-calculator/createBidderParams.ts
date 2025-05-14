import { type ArgonClient } from '@argonprotocol/mainchain';
import type IBidderParams from '../IBidderParams';
import type IBiddingRules from './IBiddingRules';
import BiddingCalculator from './BiddingCalculator';
import BiddingCalculatorData from './BiddingCalculatorData';

const MICROGONS_PER_ARGON = 1_000_000;

export default async function createBidderParams(
  cohortId: number,
  client: ArgonClient,
  biddingRules: IBiddingRules,
): Promise<IBidderParams> {
  const helper = new Helper(biddingRules);

  const minBid = await helper.calculateMinBid();
  const maxBid = await helper.calculateMaxBid();

  const maxSeats = await helper.getMaxSeats();
  const maxBudget = helper.getMaxBalance(maxBid * BigInt(maxSeats));
  const bidDelay = biddingRules.rebiddingDelay || 0;
  const bidIncrement = convertArgonToMicrogons(biddingRules.incrementAmount || 1);
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

  constructor(biddingRules: IBiddingRules) {
    this.biddingRules = biddingRules;
    this.calculatorData = new BiddingCalculatorData();
    this.startingMinimumCalculator = new BiddingCalculator('Minimum', this.calculatorData);
    this.startingOptimisticCalculator = new BiddingCalculator('Optimistic', this.calculatorData);
    this.finalMinimumCalculator = new BiddingCalculator('Minimum', this.calculatorData);
    this.finalOptimisticCalculator = new BiddingCalculator('Optimistic', this.calculatorData);
  }

  public async getMaxSeats() {
    await this.calculatorData.isInitialized;

    let maxSeats = this.calculatorData.miningSeatCount / 10;
    if (this.biddingRules.throttleSeats) {
      maxSeats = this.biddingRules.throttleSeatCount || 0;
    }

    return (maxSeats > 0 && this.biddingRules.disableBot === 'AfterFirstSeat') ? 1 : maxSeats;
  }

  public getMaxBalance(defaultMaxBalance: bigint): bigint {
    return this.biddingRules.throttleSpending ? BigInt(this.biddingRules.throttleSpendingAmount || 0) : defaultMaxBalance;
  }

  public async calculateMinBid(): Promise<bigint> {
    if (this.biddingRules.startingAmountFormulaType === 'Custom') {
      return convertArgonToMicrogons(this.biddingRules.startingAmount);
    }

    await this.calculatorData.isInitialized;
    let formulaAmount = 0;

    if (this.biddingRules.startingAmountFormulaType === 'PreviousLowestBid') {
      formulaAmount = this.calculatorData.previousLowestBid;
    } else if (this.biddingRules.startingAmountFormulaType === 'MinimumBreakeven') {
      formulaAmount = this.startingMinimumCalculator.breakevenBid;
    } else if (this.biddingRules.startingAmountFormulaType === 'OptimisticBreakeven') {
      formulaAmount = this.startingOptimisticCalculator.breakevenBid;
    }

    const minBid = formulaAmount * (1 + this.biddingRules.startingAmountFormulaIncrease / 100);

    return convertArgonToMicrogons(minBid);
  }

  public async calculateMaxBid(): Promise<bigint> {
    if (this.biddingRules.finalAmountFormulaType === 'Custom') {
      return convertArgonToMicrogons(this.biddingRules.finalAmount);
    }

    await this.calculatorData.isInitialized;
    let formulaAmount = 0;

    if (this.biddingRules.finalAmountFormulaType === 'PreviousHighestBid') {
      formulaAmount = this.calculatorData.previousHighestBid;
    } else if (this.biddingRules.finalAmountFormulaType === 'MinimumBreakeven') {
      formulaAmount = this.finalMinimumCalculator.breakevenBid;
    } else if (this.biddingRules.finalAmountFormulaType === 'OptimisticBreakeven') {
      formulaAmount = this.finalOptimisticCalculator.breakevenBid;
    }

    const maxBid = formulaAmount * (1 + this.biddingRules.finalAmountFormulaIncrease / 100);

    return convertArgonToMicrogons(maxBid);
  }
}

function convertArgonToMicrogons(amount: number): bigint {
  return BigInt(Math.round(amount * MICROGONS_PER_ARGON));
}
