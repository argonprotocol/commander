import { IBlockNumbers } from '@argonprotocol/commander-bot/src/Dockers';
import {
  ISyncState,
  IEarningsFile,
  IBidsFile,
  IBidsHistory,
  IWinningBid,
} from '@argonprotocol/commander-bot/src/storage';
import { convertBigIntStringToNumber } from '../Utils';
import { SSH } from '../SSH.ts';

export class StatsFetcher {
  public static async fetchSyncState(retries = 0): Promise<ISyncState> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Fetching bot status...', `::remote::/sync-state`);
    try {
      const response = await SSH.runHttpGet<ISyncState>(`sync-state`);
      if (response.status !== 200) {
        throw new Error(`Failed to fetch bot status: ${response.status}`);
      }
      const data = response.data;
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
        maxSeatsPossible: data.maxSeatsPossible,
        maxSeatsReductionReason: data.maxSeatsReductionReason,
      };
    } catch (error) {
      if (retries > 3) {
        throw error;
      }
      retries += 1;
      const retryIn = Math.pow(2, retries) * 1000;
      console.log(`Error fetching bot status, retrying in ${retryIn / 1000}s...`, error);
      await new Promise(resolve => setTimeout(resolve, retryIn));
      return this.fetchSyncState(retries);
    }
  }

  public static async fetchArgonBlockchainStatus(): Promise<IBlockNumbers> {
    const { data } = await SSH.runHttpGet<IBlockNumbers>(`argon-blockchain-status`);
    return { localNode: data.localNode, mainNode: data.mainNode };
  }

  public static async fetchBitcoinBlockchainStatus(): Promise<IBlockNumbers> {
    const { data } = await SSH.runHttpGet<IBlockNumbers>(`bitcoin-blockchain-status`);
    return { localNode: data.localNode, mainNode: data.mainNode };
  }

  public static async fetchBotHistory(): Promise<IBidsHistory> {
    const { data } = await SSH.runHttpGet<IBidsHistory>(`bid-history`);

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
    const { data } = await SSH.runHttpGet<IEarningsFile>(`earnings/${frameId}`);
    console.log('Earnings file fetched:', data);
    const byCohortActivatingFrameIdRaw = Object.entries(data.byCohortActivatingFrameId);
    const byCohortActivatingFrameId = byCohortActivatingFrameIdRaw.map(([frameId, value]) => [
      frameId,
      {
        lastBlockMinedAt: value.lastBlockMinedAt,
        blocksMined: value.blocksMined,
        argonsMined: convertBigIntStringToNumber(value.argonsMined as unknown as string) as bigint,
        argonsMinted: convertBigIntStringToNumber(value.argonsMinted as unknown as string) as bigint,
        argonotsMined: convertBigIntStringToNumber(value.argonotsMined as unknown as string) as bigint,
      },
    ]);

    console.log('By cohort activating frame id:', byCohortActivatingFrameId);
    return {
      frameId: data.frameId,
      frameProgress: data.frameProgress,
      firstTick: data.firstTick,
      lastTick: data.lastTick,
      firstBlockNumber: data.firstBlockNumber,
      lastBlockNumber: data.lastBlockNumber,
      byCohortActivatingFrameId: Object.fromEntries(byCohortActivatingFrameId),
    };
  }

  public static async fetchBidsFile(frameId?: number): Promise<IBidsFile> {
    let url = `/bids`;
    if (frameId) {
      url += `/${frameId}`;
    }
    const { data } = await SSH.runHttpGet<IBidsFile>(url);
    console.log('Bids file fetched:', data);
    return {
      cohortBiddingFrameId: data.cohortBiddingFrameId,
      cohortActivatingFrameId: data.cohortActivatingFrameId,
      frameBiddingProgress: data.frameBiddingProgress,
      lastBlockNumber: data.lastBlockNumber,
      argonsBidTotal: convertBigIntStringToNumber(data.argonsBidTotal as unknown as string) as bigint,
      transactionFees: convertBigIntStringToNumber(data.transactionFees as unknown as string) as bigint,
      argonotsStakedPerSeat: convertBigIntStringToNumber(data.argonotsStakedPerSeat as unknown as string) as bigint,
      argonotsUsdPrice: data.argonotsUsdPrice,
      argonsToBeMinedPerBlock: convertBigIntStringToNumber(data.argonsToBeMinedPerBlock as unknown as string) as bigint,
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
