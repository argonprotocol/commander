import {
  BLOCK_REWARD_INCREASE_PER_INTERVAL,
  BLOCK_REWARD_INTERVAL,
  BLOCK_REWARD_MAX,
  MICROGONS_PER_ARGON,
  Mainchain,
} from './Mainchain.js';
import { TICKS_PER_COHORT } from './MiningFrames.js';
import { bigIntMax, bigIntMin } from './utils.js';
import BigNumber from 'bignumber.js';

export default class BiddingCalculatorData {
  public isInitialized: Promise<void>;

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
    this.isInitialized = this.initialize(mainchain);
  }

  private async initialize(mainchain: Mainchain) {
    try {
      const tickAtStartOfNextCohort = await mainchain.getTickAtStartOfNextCohort();
      const tickAtEndOfNextCohort = tickAtStartOfNextCohort + BigInt(TICKS_PER_COHORT);
      const tickAtEndOfYear = tickAtStartOfNextCohort + BigInt(365 * 1_440);

      const miningSeatCount = await mainchain.getMiningSeatCount();

      const previousDayWinningBids = await mainchain.fetchPreviousDayWinningBids();
      this.previousDayHighBid = bigIntMax(...previousDayWinningBids);
      this.previousDayLowBid = bigIntMin(...previousDayWinningBids);
      this.previousDayMidBid = BigInt(
        BigNumber(this.previousDayHighBid).plus(this.previousDayLowBid).dividedBy(2).integerValue().toString(),
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
      this.miningSeatCount = await mainchain.getMiningSeatCount();
    } catch (e) {
      console.error('Error initializing BiddingCalculatorData', e);
      throw e;
    }
  }

  private async estimateBlockRewardsForFullYear(mainchain: Mainchain, currentRewardsPerBlock: bigint): Promise<bigint> {
    // TODO: We need to improve this function to calculate the minimumRewardsPerBlock at the tick being analyzed in for loop
    const intervalsPerYear = BigInt(365 * 1_440) / BLOCK_REWARD_INTERVAL;
    const currentTick = BigInt(await mainchain.getCurrentTick());
    const startingRewardsPerBlock = await mainchain.minimumBlockRewardsAtTick(currentTick);

    let totalRewards = 0n;
    let minimumRewardsPerBlock = startingRewardsPerBlock;
    for (let i = 0; i < intervalsPerYear; i++) {
      minimumRewardsPerBlock += BLOCK_REWARD_INCREASE_PER_INTERVAL;
      minimumRewardsPerBlock = bigIntMin(minimumRewardsPerBlock, BLOCK_REWARD_MAX);
      currentRewardsPerBlock = bigIntMax(minimumRewardsPerBlock, currentRewardsPerBlock);
      totalRewards += currentRewardsPerBlock * BLOCK_REWARD_INTERVAL;
    }

    const intervalsPerYearRemainder = intervalsPerYear % 1n;
    if (intervalsPerYearRemainder > 0) {
      totalRewards += currentRewardsPerBlock * (BLOCK_REWARD_INTERVAL * intervalsPerYearRemainder);
    }

    return totalRewards;
  }
}
