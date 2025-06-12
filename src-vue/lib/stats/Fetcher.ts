// import { fetch } from '@tauri-apps/plugin-http';
import { IBlockNumbers } from '@argonprotocol/commander-bot/src/Dockers';
import {
  ISyncState,
  IEarningsFile,
  IBidsFile,
  IBidsHistory,
  IWinningBid,
} from '@argonprotocol/commander-bot/src/storage';
import { convertBigIntStringToNumber } from '../Utils';

export class StatsFetcher {
  public static async fetchSyncState(localPort: number, retries: number = 0): Promise<ISyncState> {
    console.log('Fetching bot status...', `http://127.0.0.1:${localPort}/sync-state`);
    try {
      const response = await fetch(`http://127.0.0.1:${localPort}/sync-state`);
      const data = await response.json();
      console.log('SyncState fetched:', data);
      return {
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
        loadProgress: data.loadProgress,
        queueDepth: data.queueDepth,
      };
    } catch (error) {
      if (retries > 3) {
        throw error;
      }
      retries += 1;
      const retryIn = Math.pow(2, retries) * 1000;
      console.log(`Error fetching bot status, retrying in ${retryIn / 1000}s...`, error);
      await new Promise(resolve => setTimeout(resolve, retryIn));
      return this.fetchSyncState(localPort, retries);
    }
  }

  public static async fetchArgonBlockchainStatus(localPort: number): Promise<IBlockNumbers> {
    const response = await fetch(`http://127.0.0.1:${localPort}/argon-blockchain-status`);
    const data: IBlockNumbers = await response.json();
    return { localNode: data.localNode, mainNode: data.mainNode };
  }

  public static async fetchBitcoinBlockchainStatus(localPort: number): Promise<IBlockNumbers> {
    const response = await fetch(`http://127.0.0.1:${localPort}/bitcoin-blockchain-status`);
    const data: IBlockNumbers = await response.json();
    return { localNode: data.localNode, mainNode: data.mainNode };
  }

  public static async fetchBotHistory(localPort: number): Promise<IBidsHistory> {
    const response = await fetch(`http://127.0.0.1:${localPort}/bid-history`);
    const data: IBidsHistory = await response.json();

    return data.map(x => ({
      cohortId: x.cohortId,
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
            bidPerSeat: convertBigIntStringToNumber(
              x.myBidsPlaced.bidPerSeat as unknown as string,
            ) as bigint,
            txFeePlusTip: convertBigIntStringToNumber(
              x.myBidsPlaced.txFeePlusTip as unknown as string,
            ) as bigint,
            successfulBids: x.myBidsPlaced.successfulBids,
            failureReason: x.myBidsPlaced.failureReason,
          }
        : undefined,
      winningSeats: x.winningSeats,
      maxSeatsInPlay: x.maxSeatsInPlay,
      maxSeatsReductionReason: x.maxSeatsReductionReason,
    }));
  }

  public static async fetchEarningsFile(
    localPort: number,
    frameId: number,
  ): Promise<IEarningsFile> {
    console.log(`Fetching http://127.0.0.1:${localPort}/earnings/${frameId}`);
    const response = await fetch(`http://127.0.0.1:${localPort}/earnings/${frameId}`);
    const data: IEarningsFile = await response.json();
    console.log('Earnings file fetched:', data);
    const byCohortActivatingFrameId = Object.entries(data.byCohortActivatingFrameId).map(
      ([cohortActivatingFrameId, value]) => [
        cohortActivatingFrameId,
        {
          lastBlockMinedAt: value.lastBlockMinedAt,
          blocksMined: value.blocksMined,
          argonsMined: convertBigIntStringToNumber(
            value.argonsMined as unknown as string,
          ) as bigint,
          argonsMinted: convertBigIntStringToNumber(
            value.argonsMinted as unknown as string,
          ) as bigint,
          argonotsMined: convertBigIntStringToNumber(
            value.argonotsMined as unknown as string,
          ) as bigint,
        },
      ],
    );
    console.log('By cohort activating frame id:', byCohortActivatingFrameId);
    return {
      frameProgress: data.frameProgress,
      frameTickStart: data.frameTickStart,
      frameTickEnd: data.frameTickEnd,
      lastBlockNumber: data.lastBlockNumber,
      byCohortActivatingFrameId: Object.fromEntries(byCohortActivatingFrameId),
    };
  }

  public static async fetchBidsFile(localPort: number, frameId: number): Promise<IBidsFile> {
    const response = await fetch(`http://127.0.0.1:${localPort}/bids/${frameId}`);
    const data = await response.json();
    console.log('Bids file fetched:', data);
    return {
      cohortBiddingFrameId: data.cohortBiddingFrameId,
      cohortActivatingFrameId: data.cohortActivatingFrameId,
      frameBiddingProgress: data.frameBiddingProgress,
      lastBlockNumber: data.lastBlockNumber,
      argonsBidTotal: convertBigIntStringToNumber(
        data.argonsBidTotal as unknown as string,
      ) as bigint,
      transactionFees: convertBigIntStringToNumber(
        data.transactionFees as unknown as string,
      ) as bigint,
      argonotsStakedPerSeat: convertBigIntStringToNumber(
        data.argonotsStakedPerSeat as unknown as string,
      ) as bigint,
      argonotsUsdPrice: data.argonotsUsdPrice,
      argonsToBeMinedPerBlock: convertBigIntStringToNumber(
        data.argonsToBeMinedPerBlock as unknown as string,
      ) as bigint,
      seatsWon: data.seatsWon,
      winningBids: data.winningBids.map((x: IWinningBid) => ({
        address: x.address,
        subAccountIndex: x.subAccountIndex,
        lastBidAtTick: x.lastBidAtTick,
        bidPosition: x.bidPosition,
        argonsBid: convertBigIntStringToNumber(x.argonsBid as unknown as string),
      })),
    };
  }
}
