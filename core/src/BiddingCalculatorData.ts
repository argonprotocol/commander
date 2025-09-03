import BigNumber from 'bignumber.js';
import {
  BLOCK_REWARD_INCREASE_PER_INTERVAL,
  BLOCK_REWARD_INTERVAL,
  BLOCK_REWARD_MAX,
  Mainchain,
  MICROGONS_PER_ARGON,
} from './Mainchain.js';
import { TICKS_PER_COHORT } from './MiningFrames.js';
import { bigIntMax, bigIntMin, bigNumberToBigInt } from './utils.js';

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

  public maxPossibleMiningSeatCount: number = 0;
  public nextCohortSize: number = 0;

  constructor(mainchain: Mainchain) {
    this.isInitializedPromise = this.initialize(mainchain);
  }

  private async initialize(mainchain: Mainchain) {
    try {
      const tickAtStartOfNextCohort = await mainchain.getTickAtStartOfNextCohort();
      const tickAtEndOfNextCohort = tickAtStartOfNextCohort + TICKS_PER_COHORT;

      const activeMinersCount = await mainchain.getActiveMinersCount();
      const nextCohortSize = await mainchain.getNextCohortSize();
      this.nextCohortSize = nextCohortSize;
      const retiringCohortSize = await mainchain.getRetiringCohortSize();
      const miningSeatCount = activeMinersCount + nextCohortSize - retiringCohortSize;

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
      this.micronotsRequiredForBid = await mainchain.getMicronotsRequiredForBid();

      const micronotsMinedDuringNextCohort = await mainchain.getMinimumMicronotsMinedDuringTickRange(
        tickAtStartOfNextCohort,
        tickAtEndOfNextCohort,
      );
      this.micronotsToMineThisSeat = micronotsMinedDuringNextCohort / BigInt(miningSeatCount);

      this.microgonExchangeRateTo = await mainchain.fetchMicrogonExchangeRatesTo();
      this.maxPossibleMiningSeatCount = miningSeatCount;
    } catch (e) {
      console.error('Error initializing BiddingCalculatorData', e);
      throw e;
    }
  }

  private async estimateBlockRewardsForFullYear(mainchain: Mainchain, currentRewardsPerBlock: bigint): Promise<bigint> {
    const yearOfTicks = 365 * 1440;
    const currentTick = await mainchain.getCurrentTick();
    const {
      rewardsPerBlock: startingRewardsPerBlock,
      amountToMinerPercent,
      ticksSinceGenesis,
    } = await mainchain.minimumBlockRewardsAtTick(currentTick);
    let totalRewards = 0n;
    let minimumRewardsPerBlock = startingRewardsPerBlock;
    for (let tick = 0; tick <= yearOfTicks; tick++) {
      const elapsed = ticksSinceGenesis + tick;
      if (elapsed % BLOCK_REWARD_INTERVAL === 0 && tick > 0) {
        minimumRewardsPerBlock += BLOCK_REWARD_INCREASE_PER_INTERVAL;
        minimumRewardsPerBlock = bigIntMin(minimumRewardsPerBlock, BLOCK_REWARD_MAX);
        currentRewardsPerBlock = bigIntMax(minimumRewardsPerBlock, currentRewardsPerBlock);
      }
      totalRewards += currentRewardsPerBlock;
    }

    return bigNumberToBigInt(amountToMinerPercent.times(totalRewards));
  }
}
