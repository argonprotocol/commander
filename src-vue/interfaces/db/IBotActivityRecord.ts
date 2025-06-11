export interface IBotActivityRecord {
  blockNumber: number;
  tick: number;
  address: string;
  bidAmount: number;
  bidPosition: number;
  prevPosition: number;
  insertedAt: string;
}