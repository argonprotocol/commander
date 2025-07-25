export interface ICohortRecord {
  id: number;
  progress: number;
  transactionFees: bigint;
  micronotsStaked: bigint;
  microgonsBid: bigint;
  seatsWon: number;
  microgonsToBeMined: bigint;
  micronotsToBeMined: bigint;
  createdAt: string;
  updatedAt: string;
}
