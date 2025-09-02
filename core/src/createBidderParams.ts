import { type IBidderParams } from './IBidderParams.js';
import { type IBiddingRules, SeatGoalType } from './IBiddingRules.js';
import BiddingCalculator from './BiddingCalculator.js';
import BiddingCalculatorData from './BiddingCalculatorData.js';
import { Mainchain } from './Mainchain.js';
import type { MainchainClients } from './MainchainClients.js';

export default async function createBidderParams(
  _cohortId: number,
  mainchainClients: MainchainClients,
  biddingRules: IBiddingRules,
  accruedEarnings: bigint,
): Promise<IBidderParams> {
  const mainchain = new Mainchain(mainchainClients);

  const calculatorData = new BiddingCalculatorData(mainchain);
  const calculator = new BiddingCalculator(calculatorData, biddingRules);
  await calculator.isInitializedPromise;

  const helper = new Helper(biddingRules, calculator);

  const minBid = calculator.minimumBidAmount;
  const maxBid = calculator.maximumBidAmount;

  const maxSeats = await helper.getMaxSeats();
  const maxBudget = biddingRules.baseMicrogonCommitment + accruedEarnings;

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
  private readonly calculator: BiddingCalculator;

  constructor(biddingRules: IBiddingRules, calculator: BiddingCalculator) {
    this.biddingRules = biddingRules;
    this.calculator = calculator;
  }

  public async getMaxSeats() {
    await this.calculator.data.isInitializedPromise;

    const maxSeats = this.calculator.data.miningSeatCount / 10;

    if (this.biddingRules.seatGoalType === SeatGoalType.Max) {
      return this.biddingRules.seatGoalCount || 0;
    }

    return maxSeats;
  }

  public getMaxBalance(defaultMaxBalance: bigint): bigint {
    return defaultMaxBalance;
  }
}
