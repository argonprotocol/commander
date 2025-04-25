export default interface IBidderParams {
    minBid: bigint;
    maxBid: bigint;
    maxBalance: bigint;
    maxSeats: number;
    bidIncrement: bigint;
    bidDelay: number;
  }