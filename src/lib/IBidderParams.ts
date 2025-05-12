export default interface IBidderParams {
    minBid: bigint;
    maxBid: bigint;
    maxBudget: bigint;
    maxSeats: number;
    bidIncrement: bigint;
    bidDelay: number;
  }
