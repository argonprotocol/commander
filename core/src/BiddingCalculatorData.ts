import BigNumber from 'bignumber.js';
import {
  BLOCK_REWARD_INCREASE_PER_INTERVAL,
  BLOCK_REWARD_INTERVAL,
  BLOCK_REWARD_MAX,
  MICROGONS_PER_ARGON,
  Mainchain,
} from './Mainchain.ts';
import { TICKS_PER_COHORT } from './MiningFrames.ts';
import { bigIntMax, bigIntMin, bigNumberToBigInt } from './utils.ts';

export default class BiddingCalculatorData {
  public isInitializedPromise: Promise<void>;

  public microgonsMinedThisNextYear: bigint = 0n;
  public microgonsToMineThisSeat: bigint = 0n;
  public micronotsToMineThisSeat: bigint = 0n;
  public micronotsRequiredForBid: bigint = 0n;

  public microgonsInCirculation: bigint = 0n;

  public previousDayHighBid: bigint = 0n;
  public previousDayMidBid: bigint = 0n;
  public previousDayLowBid: bigint = 0n;

  public estimatedTransactionFee: bigint = BigInt(0.1 * MICROGONS_PER_ARGON);

  public microgonExchangeRateTo: { USD: bigint; ARGNOT: bigint } = { USD: BigInt(0), ARGNOT: BigInt(0) };

  public miningSeatCount: number = 0;

  constructor(mainchain: Mainchain) {
    this.isInitializedPromise = this.initialize(mainchain);
  }

  private async initialize(mainchain: Mainchain) {
    try {
      const tickAtStartOfNextCohort = await mainchain.getTickAtStartOfNextCohort();
      const tickAtEndOfNextCohort = tickAtStartOfNextCohort + TICKS_PER_COHORT;

      const miningSeatCount = await mainchain.getMiningSeatCount();
      const previousDayWinningBids = await mainchain.fetchPreviousDayWinningBidAmounts();
      this.previousDayHighBid = previousDayWinningBids.length > 0 ? bigIntMax(...previousDayWinningBids) : 0n;
      this.previousDayLowBid = previousDayWinningBids.length > 0 ? bigIntMin(...previousDayWinningBids) : 0n;
      this.previousDayMidBid = bigNumberToBigInt(
        BigNumber(this.previousDayHighBid).plus(this.previousDayLowBid).dividedBy(2),
      );

      const microgonsMinedPerBlock = await mainchain.fetchMicrogonsMinedPerBlockDuringNextCohort();
      this.microgonsMinedThisNextYear = await this.estimateBlockRewardsForFullYear(mainchain, microgonsMinedPerBlock);
      this.microgonsToMineThisSeat = (microgonsMinedPerBlock * 14_400n) / BigInt(miningSeatCount);
      this.microgonsInCirculation = await mainchain.fetchMicrogonsInCirculation();
      this.micronotsRequiredForBid = await mainchain.getMinimumMicronotsForBid();

      const micronotsMinedDuringNextCohort = await mainchain.getMinimumBlockRewardsDuringTickRange(
        tickAtStartOfNextCohort,
        tickAtEndOfNextCohort,
      );
      this.micronotsToMineThisSeat = micronotsMinedDuringNextCohort / BigInt(miningSeatCount);

      this.microgonExchangeRateTo = await mainchain.fetchMicrogonExchangeRatesTo();
      this.miningSeatCount = miningSeatCount;
    } catch (e) {
      console.error('Error initializing BiddingCalculatorData', e);
      throw e;
    }
  }

  private async estimateBlockRewardsForFullYear(mainchain: Mainchain, currentRewardsPerBlock: bigint): Promise<bigint> {
    // TODO: We need to improve this function to calculate the minimumRewardsPerBlock at the tick being analyzed in for loop
    const intervalsPerYear = (365 * 1_440) / BLOCK_REWARD_INTERVAL;
    const currentTick = await mainchain.getCurrentTick();
    const startingRewardsPerBlock = await mainchain.minimumBlockRewardsAtTick(currentTick);

    let totalRewards = 0n;
    let minimumRewardsPerBlock = startingRewardsPerBlock;
    for (let i = 0; i < intervalsPerYear; i++) {
      minimumRewardsPerBlock += BLOCK_REWARD_INCREASE_PER_INTERVAL;
      minimumRewardsPerBlock = bigIntMin(minimumRewardsPerBlock, BLOCK_REWARD_MAX);
      currentRewardsPerBlock = bigIntMax(minimumRewardsPerBlock, currentRewardsPerBlock);
      totalRewards += currentRewardsPerBlock * BigInt(BLOCK_REWARD_INTERVAL);
    }

    const intervalsPerYearRemainder = intervalsPerYear % 1;
    if (intervalsPerYearRemainder > 0) {
      totalRewards += currentRewardsPerBlock * BigInt(Math.floor(BLOCK_REWARD_INTERVAL * intervalsPerYearRemainder));
    }

    return totalRewards;
  }
}
