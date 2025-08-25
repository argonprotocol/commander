import { CohortBidder } from './CohortBidder.js';

export type IBidderParams = CohortBidder['options'] & {
  maxSeats: number;
};
