import {
  type IBotState,
  type IEarningsFile,
  type IBidsFile,
  type IBotStateStarting,
  type IBotStateError,
  type IHistoryFile,
  type IBlockNumbers,
} from '@argonprotocol/commander-bot';
import { SSH } from './SSH.ts';
import { BotServerError, BotServerIsLoading, BotServerIsSyncing } from '../interfaces/BotErrors.ts';

export class BotFetch {
  public static async fetchBotState(retries = 0): Promise<IBotState> {
    try {
      const response = await SSH.runHttpGet<IBotState | IBotStateStarting | IBotStateError>(`/state`);

      if ((response.data as IBotStateError).serverError) {
        throw new BotServerError(response.data as IBotStateError);
      } else if (response.data.isSyncing) {
        throw new BotServerIsSyncing(response.data.syncProgress);
      } else if (!response.data.isReady) {
        throw new BotServerIsLoading(response.data);
      }

      return response.data as IBotState;
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

  public static async fetchHistory(): Promise<IHistoryFile> {
    const { data } = await SSH.runHttpGet<IHistoryFile>(`/history`);

    return data;
  }

  public static async fetchEarningsFile(frameId: number): Promise<IEarningsFile> {
    const { data } = await SSH.runHttpGet<IEarningsFile>(`/earnings/${frameId}`);
    return data;
  }

  public static async fetchBidsFile(cohortActivationFrameId?: number): Promise<IBidsFile> {
    let url = `/bids`;
    if (cohortActivationFrameId) {
      const cohortBiddingFrameId = cohortActivationFrameId - 1;
      url += `/${cohortBiddingFrameId}-${cohortActivationFrameId}`;
    }
    const { data } = await SSH.runHttpGet<IBidsFile>(url);
    return data;
  }
}
