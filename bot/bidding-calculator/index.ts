import { type ArgonClient } from '@argonprotocol/mainchain';
import type { IBidderParams } from '../IBidderParams.ts';

export async function createBidderParams(
  cohortId: number,
  client: ArgonClient,
  biddingRules: any,
): Promise<IBidderParams> {
  const blockNumber = await client.rpc.chain
    .getHeader()
    .then(x => x.number.toNumber());
  console.warn('Bidding rules are not implemented yet', {
    cohortId,
    biddingRules,
    blockNumber,
  });
  return {
    minBid: 0n,
    maxBid: 0n,
    maxBudget: 0n,
    bidIncrement: 0n,
    maxSeats: 0,
    bidDelay: 0,
  };
}
