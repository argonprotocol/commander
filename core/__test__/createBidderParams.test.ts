import { afterAll, afterEach, expect, it } from 'vitest';
import { startNetwork, teardown } from '@argonprotocol/testing';
import createBidderParams from '../src/createBidderParams.ts';
import { jsonParseWithBigInts } from '../src/utils.ts';
import { getClient } from '@argonprotocol/mainchain';
import { MiningFrames } from '../src/MiningFrames.ts';

afterEach(teardown);
afterAll(teardown);

it('can create bidder params', async () => {
  const network = await startNetwork();
  const client = await getClient(network.archiveUrl);

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
    "baseCapitalCommitment": "10000000n",
    "requiredMicronots": "1000000n"
  }`);
  MiningFrames.setNetwork('localnet');
  const cohortActivationFrameId = MiningFrames.calculateCurrentFrameIdFromSystemTime();
  const accruedEarnings = 10_000_253n;
  const bidderParams = await createBidderParams(cohortActivationFrameId, client, biddingRules, accruedEarnings);

  expect(bidderParams.minBid).toBe(0n);
  expect(bidderParams.maxBid).toBe(215_904_808n);
  expect(bidderParams.maxBudget).toBe(10_000_000n + accruedEarnings);
  expect(bidderParams.maxSeats).toBe(10);
  expect(bidderParams.bidDelay).toBe(1);
  expect(bidderParams.bidIncrement).toBe(1_000_000n);
});
