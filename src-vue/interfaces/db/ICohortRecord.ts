export interface ICohortRecord {
  id: number;
  progress: number;
  transactionFees: number;
  argonotsStaked: number;
  argonsBid: number;
  seatsWon: number;
  createdAt: string;
  updatedAt: string;
}

export interface ICohortRecordWithTicks {
  id: number;
  frameTickStart: number;
  frameTickEnd: number;
  transactionFees: number;
  argonotsStaked: number;
  argonsBid: number;
  seatsWon: number;
}