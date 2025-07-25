export interface ICohortFrameRecord {
  frameId: number;
  cohortId: number;
  blocksMined: number;
  micronotsMined: bigint;
  microgonsMined: bigint;
  microgonsMinted: bigint;
  createdAt: string;
  updatedAt: string;
}

export interface ICohortFrameStats {
  totalBlocksMined: number;
  totalMicronotsMined: bigint;
  totalMicrogonsMined: bigint;
  totalMicrogonsMinted: bigint;
}
