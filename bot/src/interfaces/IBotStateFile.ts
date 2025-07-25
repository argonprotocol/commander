import type { IBlockNumbers } from '../Dockers.ts';
import type { ILastModifiedAt } from './ILastModified.ts';

export interface IBotStateStarting {
  isReady: boolean;
  isStarting?: boolean;
  isWaitingForBiddingRules?: boolean;
  isSyncing?: boolean;
  syncProgress: number;
  argonBlockNumbers: IBlockNumbers;
  bitcoinBlockNumbers: IBlockNumbers;
}

export interface IBotStateError extends IBotStateStarting {
  serverError: string;
}

export interface IBotState extends ILastModifiedAt {
  isReady: boolean;
  isStarting?: boolean;
  isWaitingForBiddingRules?: boolean;
  isSyncing?: boolean;
  hasMiningBids: boolean;
  hasMiningSeats: boolean;
  argonBlockNumbers: IBlockNumbers;
  bitcoinBlockNumbers: IBlockNumbers;
  bidsLastModifiedAt: Date;
  earningsLastModifiedAt: Date;
  lastBlockNumber: number;
  lastFinalizedBlockNumber: number;
  oldestFrameIdToSync: number;
  currentFrameId: number;
  currentFrameProgress: number;
  syncProgress: number;
  queueDepth: number;
  maxSeatsPossible: number;
  maxSeatsReductionReason: string;
}

export interface IBotStateFile extends IBotState {
  lastBlockNumberByFrameId: {
    [frameId: number]: number;
  };
}
