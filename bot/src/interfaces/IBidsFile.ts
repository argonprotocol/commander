import type { ILastModifiedAt } from './ILastModified.ts';

export interface IBidsFile extends ILastModifiedAt {
  cohortBiddingFrameId: number;
  cohortActivatingFrameId: number;
  frameBiddingProgress: number;
  lastBlockNumber: number;
  microgonsBidTotal: bigint;
  transactionFees: bigint;
  micronotsStakedPerSeat: bigint;
  microgonsToBeMinedPerBlock: bigint;
  seatsWon: number;
  winningBids: Array<IWinningBid>;
}

export interface IWinningBid {
  address: string;
  subAccountIndex?: number;
  lastBidAtTick?: number;
  bidPosition?: number;
  microgonsBid?: bigint;
}
