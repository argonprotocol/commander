import { type ArgonClient } from '@argonprotocol/mainchain';
import type IBidderParams from '../IBidderParams';
import type IBiddingRules from './IBiddingRules';
import BiddingCalculator from './BiddingCalculator';
import BiddingCalculatorData from './BiddingCalculatorData';

export default async function createBidderParams(
  cohortId: number,
  client: ArgonClient,
  biddingRules: IBiddingRules,
): Promise<IBidderParams> {
  const blockNumber = await client.rpc.chain.getHeader().then(x => x.number.toNumber());
  const helper = new Helper(biddingRules);

  const minBid = helper.calculateMinBid();
  const maxBid = helper.calculateMaxBid();

  const maxBalance = helper.getMaxBalance();
  const maxSeats = helper.getMaxSeats();
  const bidDelay = biddingRules.rebiddingDelay || 0;
  const bidIncrement = BigInt(biddingRules.incrementAmount || 1);

  return {
    minBid,
    maxBid,
    maxBalance,
    maxSeats,
    bidDelay,
    bidIncrement,
  };
}

class Helper {
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

  public getMaxSeats() {
    return getMaxSeats(this.biddingRules);
  }

  public getMaxBalance(): bigint {
    return this.biddingRules.throttleSpending ? BigInt(this.biddingRules.throttleSpendingAmount || 0) : 0n;
  }

  public calculateMinBid() {
    if (this.biddingRules.startingAmountFormulaType === 'Custom') {
      return BigInt(this.biddingRules.startingAmount);
    }

    let formulaAmount = 0;

    if (this.biddingRules.startingAmountFormulaType === 'PreviousLowestBid') {
      formulaAmount = this.calculatorData.previousLowestBid;
    } else if (this.biddingRules.startingAmountFormulaType === 'MinimumBreakeven') {
      formulaAmount = this.startingMinimumCalculator.breakevenBid;
    } else if (this.biddingRules.startingAmountFormulaType === 'OptimisticBreakeven') {
      formulaAmount = this.startingOptimisticCalculator.breakevenBid;
    }

    return BigInt(formulaAmount * (1 + this.biddingRules.startingAmountFormulaIncrease / 100));
  }

  public calculateMaxBid() {
    if (this.biddingRules.finalAmountFormulaType === 'Custom') {
      return BigInt(this.biddingRules.finalAmount);
    }

    let formulaAmount = 0;

    if (this.biddingRules.finalAmountFormulaType === 'PreviousHighestBid') {
      formulaAmount = this.calculatorData.previousHighestBid;
    } else if (this.biddingRules.finalAmountFormulaType === 'MinimumBreakeven') {
      formulaAmount = this.finalMinimumCalculator.breakevenBid;
    } else if (this.biddingRules.finalAmountFormulaType === 'OptimisticBreakeven') {
      formulaAmount = this.finalOptimisticCalculator.breakevenBid;
    }

    return BigInt(formulaAmount * (1 + this.biddingRules.finalAmountFormulaIncrease / 100));
  }
}

export function getMaxSeats(biddingRules: IBiddingRules) {
  let maxSeats = biddingRules.calculatedTotalSeats;
  if (biddingRules.throttleSeats) {
    maxSeats = biddingRules.throttleSeatCount || 0;
  }
  return (maxSeats > 0 && biddingRules.disableBot === 'AfterFirstSeat') ? 1 : maxSeats;
}