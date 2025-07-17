export interface IFrameBidRecord {
  frameId: number;
  address: string;
  subAccountIndex?: number;
  microgonsBid: bigint;
  bidPosition: number;
  lastBidAtTick?: number;
  createdAt: string;
  updatedAt: string;
}
