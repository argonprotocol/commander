import type { ILastModifiedAt } from './ILastModified.ts';

export interface IEarningsFile extends ILastModifiedAt {
  frameId: number;
  frameProgress: number;
  firstTick: number;
  lastTick: number;
  firstBlockNumber: number;
  lastBlockNumber: number;
  microgonToUsd: bigint[];
  microgonToBtc: bigint[];
  microgonToArgonot: bigint[];
  byCohortActivationFrameId: {
    [cohortActivationFrameId: number]: IEarningsFileCohort;
  };
}

export interface IEarningsFileCohort {
  lastBlockMinedAt: string;
  blocksMined: number;
  microgonsMined: bigint;
  microgonsMinted: bigint;
  micronotsMined: bigint;
}
