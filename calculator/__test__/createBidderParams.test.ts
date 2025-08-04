import { afterAll, afterEach, expect, it } from 'vitest';
import { activateNotary, sudo, teardown, TestMainchain, TestNotary } from '@argonprotocol/testing';
import createBidderParams from '../src/createBidderParams.ts';
import { type IBiddingRules } from '../src/IBiddingRules.ts';
import { jsonParseWithBigInts } from '../src/utils.ts';
import { MiningFrames } from '../src/MiningFrames.ts';

afterEach(teardown);
afterAll(teardown);

it('can create bidder params', async () => {
  const chain = new TestMainchain();
  await chain.launch({ miningThreads: 1 });
  const notary = new TestNotary();
  await notary.start({
    uuid: chain.uuid,
    mainchainUrl: chain.address,
  });
  const clientPromise = chain.client();
  const client = await clientPromise;
  await activateNotary(sudo(), client, notary);

  const biddingRules = jsonParseWithBigInts(`{
    "argonCirculationGrowthPctMin": 91,
    "argonCirculationGrowthPctMax": 92,
    "argonotPriceChangeType": "Between",
    "argonotPriceChangePctMin": 0,
    "argonotPriceChangePctMax": 0,
    "minimumBidFormulaType": "PreviousDayMid",
    "minimumBidAdjustmentType": "Relative",
    "minimumBidCustom": "500000000n",
    "minimumBidAdjustAbsolute": "10000000n",
    "minimumBidAdjustRelative": 0,
    "rebiddingDelay": 1,
    "rebiddingIncrementBy": "1000000n",
    "maximumBidFormulaType": "BreakevenAtSlowGrowth",
    "maximumBidAdjustmentType": "Relative",
    "maximumBidCustom": "0n",
    "maximumBidAdjustAbsolute": "0n",
    "maximumBidAdjustRelative": -7.47,
    "seatGoalType": "Min",
    "seatGoalCount": 3,
    "seatGoalInterval": "Epoch",
    "requiredMicrogons": "10000000n",
    "requiredMicronots": "1000000n"
  }`) as IBiddingRules;
  const cohortActivationFrameId = MiningFrames.calculateCurrentFrameIdFromSystemTime();
  const bidderParams = await createBidderParams(cohortActivationFrameId, client, biddingRules);

  expect(bidderParams.minBid).toBe(0n);
  expect(bidderParams.maxBid).toBe(215_904_808n);
  expect(bidderParams.maxBudget).toBe(2_159_048_080n);
  expect(bidderParams.maxSeats).toBe(10);
  expect(bidderParams.bidDelay).toBe(1);
  expect(bidderParams.bidIncrement).toBe(1_000_000n);
});
