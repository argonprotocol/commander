export interface IBotActivityRecord {
  blockNumber: number;
  tick: number;
  address: string;
  bidAmount: bigint;
  bidPosition: number;
  prevPosition: number;
  insertedAt: string;
}
