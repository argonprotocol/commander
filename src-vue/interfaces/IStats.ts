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
  argonsBid: number | null;
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
  totalArgonsBid: number;
  totalTransactionFees: number;
  totalArgonotsMined: number;
  totalArgonsMined: number;
  totalArgonsMinted: number;
}

export interface IDashboardCohortStats {
  cohortId: number;
  firstTick: number;
  lastTick: number;
  lastBlockNumber: number;
  transactionFees: number;
  argonotsStaked: number;
  argonsBid: number;
  seatsWon: number;
  progress: number;
  blocksMined: number;
  argonotsMined: number;
  argonsMined: number;
  argonsMinted: number;
}
