import { type IBlockNumbers } from '@argonprotocol/commander-bot/src/Dockers.ts';
import {
  type IBotState,
  type IEarningsFile,
  type IBidsFile,
  type IBidsHistory,
  type IWinningBid,
  type IBotStateStarting,
  type IBotStateError,
} from '@argonprotocol/commander-bot/src/storage.ts';
import { convertBigIntStringToNumber } from '@argonprotocol/commander-calculator';
import { SSH } from './SSH.ts';
import { BotServerError, BotServerIsLoading, BotServerIsSyncing } from '../interfaces/BotErrors.ts';

export class BotFetch {
  public static async fetchBotState(retries = 0): Promise<IBotState> {
    try {
      const response = await SSH.runHttpGet<IBotState | IBotStateStarting | IBotStateError>(`/bot-state`);

      if ((response.data as IBotStateError).serverError) {
        throw new BotServerError(response.data as IBotStateError);
      } else if (response.data.isSyncing) {
        throw new BotServerIsSyncing(response.data.syncProgress);
      } else if (!response.data.isReady) {
        throw new BotServerIsLoading(response.data);
      }

      const data = response.data as IBotState;

      return {
        isReady: data.isReady,
        hasMiningSeats: data.hasMiningSeats,
        hasMiningBids: data.hasMiningBids,
        argonBlockNumbers: {
          localNode: data.argonBlockNumbers.localNode,
          mainNode: data.argonBlockNumbers.mainNode,
        },
        bitcoinBlockNumbers: {
          localNode: data.bitcoinBlockNumbers.localNode,
          mainNode: data.bitcoinBlockNumbers.mainNode,
        },
        bidsLastModifiedAt: data.bidsLastModifiedAt,
        earningsLastModifiedAt: data.earningsLastModifiedAt,
        lastBlockNumber: data.lastBlockNumber,
        lastFinalizedBlockNumber: data.lastFinalizedBlockNumber,
        oldestFrameIdToSync: data.oldestFrameIdToSync,
        currentFrameId: data.currentFrameId,
        currentFrameProgress: data.currentFrameProgress,
        syncProgress: data.syncProgress,
        queueDepth: data.queueDepth,
        maxSeatsPossible: data.maxSeatsPossible,
        maxSeatsReductionReason: data.maxSeatsReductionReason,
      };
    } catch (error) {
      if (
        error instanceof BotServerError ||
        error instanceof BotServerIsLoading ||
        error instanceof BotServerIsSyncing
      ) {
        throw error;
      } else if (error === 'ServerUnavailable') {
        throw new BotServerIsLoading({
          isReady: false,
          isStarting: true,
          syncProgress: 0,
          argonBlockNumbers: { localNode: 0, mainNode: 0 },
          bitcoinBlockNumbers: { localNode: 0, mainNode: 0 },
        });
      }

      if (retries > 3) {
        throw error;
      }
      retries += 1;
      const retryIn = Math.pow(2, retries) * 1000;
      console.log(`Error fetching bot status, retrying in ${retryIn / 1000}s...`, error);
      await new Promise(resolve => setTimeout(resolve, retryIn));
      return this.fetchBotState(retries);
    }
  }

  public static async fetchArgonBlockchainStatus(): Promise<IBlockNumbers> {
    const { data } = await SSH.runHttpGet<IBlockNumbers>(`/argon-blockchain-status`);
    return { localNode: data.localNode, mainNode: data.mainNode };
  }

  public static async fetchBitcoinBlockchainStatus(): Promise<IBlockNumbers> {
    const { data } = await SSH.runHttpGet<IBlockNumbers>(`/bitcoin-blockchain-status`);
    return { localNode: data.localNode, mainNode: data.mainNode };
  }

  public static async fetchBotHistory(): Promise<IBidsHistory> {
    const { data } = await SSH.runHttpGet<IBidsHistory>(`/bid-history`);

    return data.map(x => ({
      cohortStartingFrameId: x.cohortStartingFrameId,
      blockNumber: x.blockNumber,
      tick: x.tick,
      bidChanges: x.bidChanges.map(y => ({
        address: y.address,
        bidAmount: convertBigIntStringToNumber(y.bidAmount as unknown as string) as bigint,
        bidPosition: y.bidPosition,
        prevPosition: y.prevPosition,
        prevBidAmount: convertBigIntStringToNumber(y.prevBidAmount as unknown as string),
      })),
      myBidsPlaced: x.myBidsPlaced
        ? {
            bids: x.myBidsPlaced.bids,
            bidPerSeat: convertBigIntStringToNumber(x.myBidsPlaced.bidPerSeat as unknown as string) as bigint,
            txFeePlusTip: convertBigIntStringToNumber(x.myBidsPlaced.txFeePlusTip as unknown as string) as bigint,
            successfulBids: x.myBidsPlaced.successfulBids,
            failureReason: x.myBidsPlaced.failureReason,
          }
        : undefined,
      winningSeats: x.winningSeats,
      maxSeatsInPlay: x.maxSeatsInPlay,
      maxSeatsReductionReason: x.maxSeatsReductionReason,
    }));
  }

  public static async fetchEarningsFile(frameId: number): Promise<IEarningsFile> {
    console.log(`Fetching earnings/${frameId}`);
    const { data } = await SSH.runHttpGet<IEarningsFile>(`/earnings/${frameId}`);
    console.log('Earnings file fetched:', data);
    const byCohortActivatingFrameIdRaw = Object.entries(data.byCohortActivatingFrameId);
    const byCohortActivatingFrameId = byCohortActivatingFrameIdRaw.map(([frameId, value]) => [
      frameId,
      {
        lastBlockMinedAt: value.lastBlockMinedAt,
        blocksMined: value.blocksMined,
        microgonsMined: convertBigIntStringToNumber(value.microgonsMined as unknown as string) as bigint,
        microgonsMinted: convertBigIntStringToNumber(value.microgonsMinted as unknown as string) as bigint,
        micronotsMined: convertBigIntStringToNumber(value.micronotsMined as unknown as string) as bigint,
      },
    ]);

    console.log('By cohort activating frame id:', byCohortActivatingFrameId);
    return {
      ...data,
      byCohortActivatingFrameId: Object.fromEntries(byCohortActivatingFrameId),
    };
  }

  public static async fetchBidsFile(frameId?: number): Promise<IBidsFile> {
    let url = `/bids`;
    if (frameId) {
      url += `/${frameId}`;
    }
    const { data } = await SSH.runHttpGet<IBidsFile>(url);
    return {
      cohortBiddingFrameId: data.cohortBiddingFrameId,
      cohortActivatingFrameId: data.cohortActivatingFrameId,
      frameBiddingProgress: data.frameBiddingProgress,
      lastBlockNumber: data.lastBlockNumber,
      microgonsBidTotal: convertBigIntStringToNumber(data.microgonsBidTotal as unknown as string) as bigint,
      transactionFees: convertBigIntStringToNumber(data.transactionFees as unknown as string) as bigint,
      micronotsStakedPerSeat: convertBigIntStringToNumber(data.micronotsStakedPerSeat as unknown as string) as bigint,
      argonotsUsdPrice: data.argonotsUsdPrice,
      microgonsToBeMinedPerBlock: convertBigIntStringToNumber(
        data.microgonsToBeMinedPerBlock as unknown as string,
      ) as bigint,
      seatsWon: data.seatsWon,
      winningBids: data.winningBids.map((x: IWinningBid) => ({
        address: x.address,
        subAccountIndex: x.subAccountIndex,
        lastBidAtTick: x.lastBidAtTick,
        bidPosition: x.bidPosition,
        microgonsBid: convertBigIntStringToNumber(x.microgonsBid as unknown as string),
      })),
    };
  }
}
