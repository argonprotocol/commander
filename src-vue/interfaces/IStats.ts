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

export interface IDashboardGlobalStats {
  totalSeats: number;
  framesMined: number;
  framesRemaining: number;
  framedCost: bigint;
  totalMicrogonsBid: bigint;
  totalTransactionFees: bigint;
  totalMicronotsMined: bigint;
  totalMicrogonsMined: bigint;
  totalMicrogonsMinted: bigint;
}

export interface IDashboardFrameStats {
  id: number;
  date: string;
  firstTick: number;
  lastTick: number;
  activeSeatCount: number;
  relativeSeatCost: bigint;
  blocksMined: number;
  microgonToUsd: bigint;
  microgonToArgonot: bigint;
  microgonsMined: bigint;
  microgonsMinted: bigint;
  micronotsMined: bigint;
  microgonValueOfRewards: bigint;
  progress: number;
  profit: number;
  apr: number;
  score: number;
}
