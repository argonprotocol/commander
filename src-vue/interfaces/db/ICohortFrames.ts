export interface ICohortFrameRecord {
  frameId: number;
  cohortId: number;
  blocksMined: number;
  argonotsMined: number;
  argonsMined: number;
  argonsMinted: number;
  createdAt: string;
  updatedAt: string;
}

export interface ICohortFrameStats {
  totalBlocksMined: number;
  totalArgonotsMined: number;
  totalArgonsMined: number;
  totalArgonsMinted: number;
}