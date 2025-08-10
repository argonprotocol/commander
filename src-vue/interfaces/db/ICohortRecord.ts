export interface ICohortRecord {
  id: number;
  progress: number;
  transactionFeesTotal: bigint;
  micronotsStakedPerSeat: bigint;
  microgonsBidPerSeat: bigint;
  seatCountWon: number;
  microgonsToBeMinedPerSeat: bigint;
  micronotsToBeMinedPerSeat: bigint;
  createdAt: string;
  updatedAt: string;
}
