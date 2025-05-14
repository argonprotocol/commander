import { CohortBidder } from '@argonprotocol/mainchain';

export type IBidderParams = CohortBidder['options'] & {
  maxSeats: number;
};
