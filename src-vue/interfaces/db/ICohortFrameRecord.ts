export interface ICohortFrameRecord {
  frameId: number;
  cohortId: number;
  blocksMinedTotal: number;
  micronotsMinedTotal: bigint;
  microgonsMinedTotal: bigint;
  microgonsMintedTotal: bigint;
  createdAt: string;
  updatedAt: string;
}

export interface ICohortFrameStats {
  blocksMinedTotal: number;
  micronotsMinedTotal: bigint;
  microgonsMinedTotal: bigint;
  microgonsMintedTotal: bigint;
}
