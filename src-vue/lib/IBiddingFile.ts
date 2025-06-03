export interface ISubaccount {
  index: number;
  address: string;
  isRebid: boolean;
}

export interface IBiddingFile {
  cohortId: number;
  lastBlock: number;
  seats: number;
  totalArgonsBid: bigint;
  fees: bigint;
  maxBidPerSeat: bigint;
  argonotsPerSeat: bigint;
  argonotUsdPrice: number;
  cohortArgonsPerBlock: bigint;
  subaccounts: ISubaccount[];
} 