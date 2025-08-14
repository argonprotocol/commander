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
  earningsByBlock: {
    [blockNumber: number]: IBlockEarningsSummary;
  };
}

export interface IBlockEarningsSummary {
  blockHash: string;
  blockMinedAt: string;
  authorCohortActivationFrameId: number;
  authorAddress: string;
  microgonFeesMined: bigint;
  microgonsMined: bigint;
  microgonsMinted: bigint;
  micronotsMined: bigint;
}

export interface IFrameEarningsRollup {
  lastBlockMinedAt: string;
  blocksMined: number;
  microgonFeesMined: bigint;
  microgonsMined: bigint;
  microgonsMinted: bigint;
  micronotsMined: bigint;
}
