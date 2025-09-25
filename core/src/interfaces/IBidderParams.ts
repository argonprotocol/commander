import type { ICohortBidderOptions } from '../CohortBidder.js';

export type IBidderParams = ICohortBidderOptions & {
  maxSeats: number;
};
