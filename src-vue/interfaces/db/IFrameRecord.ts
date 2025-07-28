export interface IFrameRecord {
  id: number;
  progress: number;
  firstTick: number;
  lastTick: number;
  microgonToUsd: bigint[];
  microgonToBtc: bigint[];
  microgonToArgonot: bigint[];
  isProcessed: boolean;
  createdAt: string;
  updatedAt: string;
}
