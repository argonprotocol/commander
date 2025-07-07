export interface IStats {
  dashboard: IDashboardStats;
  argonActivity: any[]; // TODO: Define proper type
  bitcoinActivity: any[]; // TODO: Define proper type
  botActivity: any[]; // TODO: Define proper type
}

export interface IActiveBids {
  subaccounts: IBidsFileSubaccount[];
}

export interface IBidsFileSubaccount {
  index: number;
  address: string;
  bidPosition: number | null;
  microgonsBid: bigint | null;
  isRebid: boolean | null;
  lastBidAtTick: number | null;
}

export interface IDashboardStats {
  global: IDashboardGlobalStats;
  cohortId: number | null;
  cohort: IDashboardCohortStats | null;
}

export interface IDashboardGlobalStats {
  activeCohorts: number;
  activeSeats: number;
  totalBlocksMined: number;
  totalMicrogonsBid: bigint;
  totalTransactionFees: bigint;
  totalMicronotsMined: bigint;
  totalMicrogonsMined: bigint;
  totalMicrogonsMinted: bigint;
}

export interface IDashboardCohortStats {
  cohortId: number;
  firstTick: number;
  lastTick: number;
  lastBlockNumber: number;
  transactionFees: bigint;
  micronotsStaked: bigint;
  microgonsBid: bigint;
  seatsWon: number;
  progress: number;
  blocksMined: number;
  micronotsMined: bigint;
  microgonsMined: bigint;
  microgonsMinted: bigint;
}
