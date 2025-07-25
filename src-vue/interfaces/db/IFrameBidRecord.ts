export interface IFrameBidRecord {
  frameId: number;
  confirmedAtBlockNumber: number;
  address: string;
  subAccountIndex?: number;
  microgonsBid: bigint;
  bidPosition: number;
  lastBidAtTick?: number;
  createdAt: string;
  updatedAt: string;
}
