import BigNumber from 'bignumber.js';
import { Mining } from './Mining.js';
import { TICKS_PER_COHORT } from './MiningFrames.js';
import { PriceIndex } from './PriceIndex.js';
import { bigIntMax, bigIntMin, bigNumberToBigInt } from './utils.js';
import { MICROGONS_PER_ARGON } from '@argonprotocol/mainchain';

export default class BiddingCalculatorData {
  public isInitializedPromise: Promise<void>;

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
  public allowedBidIncrementMicrogons = 10_000n;

  constructor(mining: Mining) {
    this.isInitializedPromise = this.initialize(mining);
  }

  private async initialize(mining: Mining): Promise<void> {
    try {
      const priceIndex = new PriceIndex(mining.clients);
      const tickAtStartOfNextCohort = await mining.getTickAtStartOfNextCohort();
      const tickAtEndOfNextCohort = tickAtStartOfNextCohort + TICKS_PER_COHORT;

      const activeMinersCount = await mining.getActiveMinersCount();
      const nextCohortSize = await mining.getNextCohortSize();
      this.nextCohortSize = nextCohortSize;
      const retiringCohortSize = await mining.getRetiringCohortSize();
      const maxPossibleMinersInNextEpoch = activeMinersCount + nextCohortSize - retiringCohortSize;

      const previousDayWinningBids = await mining.fetchPreviousDayWinningBidAmounts();
      this.previousDayHighBid = previousDayWinningBids.length > 0 ? bigIntMax(...previousDayWinningBids) : 0n;
      this.previousDayLowBid = previousDayWinningBids.length > 0 ? bigIntMin(...previousDayWinningBids) : 0n;
      this.previousDayMidBid = bigNumberToBigInt(
        BigNumber(this.previousDayHighBid).plus(this.previousDayLowBid).dividedBy(2),
      );

      const microgonsMinedPerBlock = await mining.fetchMicrogonsMinedPerBlockDuringNextCohort();
      this.microgonsToMineThisSeat = (microgonsMinedPerBlock * 14_400n) / BigInt(maxPossibleMinersInNextEpoch);
      this.microgonsInCirculation = await priceIndex.fetchMicrogonsInCirculation();
      this.micronotsRequiredForBid = await mining.getMicronotsRequiredForBid();

      const micronotsMinedDuringNextCohort = await mining.getMinimumMicronotsMinedDuringTickRange(
        tickAtStartOfNextCohort,
        tickAtEndOfNextCohort,
      );
      this.micronotsToMineThisSeat = micronotsMinedDuringNextCohort / BigInt(maxPossibleMinersInNextEpoch);

      this.microgonExchangeRateTo = await priceIndex.fetchMicrogonExchangeRatesTo();
      this.maxPossibleMiningSeatCount = maxPossibleMinersInNextEpoch;
      const client = await mining.clients.prunedClientOrArchivePromise;
      this.allowedBidIncrementMicrogons = client.consts.miningSlot.bidIncrements.toBigInt();
    } catch (e) {
      console.error('Error initializing BiddingCalculatorData', e);
      throw e;
    }
  }
}
