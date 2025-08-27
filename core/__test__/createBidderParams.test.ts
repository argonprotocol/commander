import { afterAll, afterEach, expect, it } from 'vitest';
import { runOnTeardown, teardown } from '@argonprotocol/testing';
import createBidderParams from '../src/createBidderParams.js';
import { type IBiddingRules, MainchainClients, MiningFrames } from '../src/index.js';
import { startArgonTestNetwork } from './startArgonTestNetwork.js';
import { JsonExt } from '../src/utils.ts';

afterEach(teardown);
afterAll(teardown);

it('can create bidder params', async () => {
  const network = await startArgonTestNetwork('bidder-params');
  const mainchainClients = new MainchainClients(network.archiveUrl);
  await mainchainClients.setPrunedClient(network.archiveUrl);
  runOnTeardown(() => mainchainClients.disconnect());

  const biddingRules = JsonExt.parse(
    JsonExt.stringify({
      argonCirculationGrowthPctMin: 91,
      argonCirculationGrowthPctMax: 92,
      argonotPriceChangeType: 'Between',
      argonotPriceChangePctMin: 0,
      argonotPriceChangePctMax: 0,
      minimumBidFormulaType: 'PreviousDayMid',
      minimumBidAdjustmentType: 'Relative',
      minimumBidCustom: 500000000n,
      minimumBidAdjustAbsolute: 10000000n,
      minimumBidAdjustRelative: 0,
      rebiddingDelay: 1,
      rebiddingIncrementBy: 1000000n,
      maximumBidFormulaType: 'BreakevenAtSlowGrowth',
      maximumBidAdjustmentType: 'Relative',
      maximumBidCustom: 0n,
      maximumBidAdjustAbsolute: 0n,
      maximumBidAdjustRelative: -7.47,
      seatGoalType: 'Min',
      seatGoalCount: 3,
      seatGoalInterval: 'Epoch',
      baseCapitalCommitment: 10000000n,
      requiredMicronots: 1000000n,
    } as IBiddingRules),
  );
  MiningFrames.setNetwork('localnet');
  const cohortActivationFrameId = MiningFrames.calculateCurrentFrameIdFromSystemTime();
  const accruedEarnings = 10_000_253n;
  const bidderParams = await createBidderParams(
    cohortActivationFrameId,
    mainchainClients,
    biddingRules,
    accruedEarnings,
  );

  expect(bidderParams.minBid).toBe(0n);
  // BAB: this is based on a breakeven at slow growth calc with the above rules and the test network state at time of writing
  expect(bidderParams.maxBid).toBe(66_532_221n);
  expect(bidderParams.maxBudget).toBe(10_000_000n + accruedEarnings);
  expect(bidderParams.maxSeats).toBe(10);
  expect(bidderParams.bidDelay).toBe(1);
  expect(bidderParams.bidIncrement).toBe(1_000_000n);
});
