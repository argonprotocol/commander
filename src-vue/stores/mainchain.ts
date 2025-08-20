import BiddingCalculator, { BiddingCalculatorData, Mainchain, MainchainClient } from '@argonprotocol/commander-core';
import { getClient } from '@argonprotocol/mainchain';
import { NETWORK_URL } from '../lib/Env.ts';
import { useConfig } from './config';
import { type IBiddingRules } from '@argonprotocol/commander-core/src/IBiddingRules.ts';
import { useBot } from './bot.ts';
import { botEmitter } from '../lib/Bot.ts';
import { wrapApi } from '@argonprotocol/commander-core/src/ClientWrapper.ts';
import { BotStatus } from '../lib/BotSyncer.ts';

let archiveClient: Promise<MainchainClient>;
let ourMinerClient: Promise<MainchainClient>;
let mainchain: Mainchain;
let calculator: BiddingCalculator;
let calculatorData: BiddingCalculatorData;

export async function getMainchainClient(preferMinerNode = false): Promise<MainchainClient> {
  if (preferMinerNode) {
    const bot = useBot();
    if (bot.isReady) {
      try {
        const client = await getMinerNodeClient();
        ourMinerClient = Promise.resolve(client);
        return ourMinerClient;
      } catch (err) {
        console.error('Failed to get mainchain client to own client:', err);
        // Fallback to archive client if miner node client fails
      }
    }
  }

  return getArchiveClient();
}

export function getArchiveClient(): Promise<MainchainClient> {
  archiveClient ??= getClient(NETWORK_URL).then(x => wrapApi(x, 'ARCHIVE_RPC'));
  return archiveClient;
}

export function setMainchainClient(newClient: Promise<MainchainClient>) {
  archiveClient = newClient;
}

export function getMinerNodeClient(): Promise<MainchainClient> {
  const config = useConfig();
  if (!config.isLoaded) {
    throw new Error('Config must be loaded before miner node client can be initialized');
  }
  return getClient(`ws://${config.serverDetails.ipAddress}:9944`).then(client => wrapApi(client, 'OUR_MINER_RPC'));
}

export function getMainchain(): Mainchain {
  if (!mainchain) {
    mainchain = new Mainchain(getMainchainClient(true));
    botEmitter.on('status-changed', async status => {
      if (status === BotStatus.Ready) {
        try {
          const client = await getMinerNodeClient();
          mainchain.clientPromise = Promise.resolve(client);
        } catch (error) {
          console.error('Failed to set mainchain client to our node:', error);
        }
      }
    });
  }
  return mainchain;
}

export function getCalculator(): BiddingCalculator {
  if (!calculator) {
    const config = useConfig();
    if (!config.isLoaded) {
      throw new Error('Config must be loaded before BiddingCalculator can be initialized');
    }
    calculator = new BiddingCalculator(getCalculatorData(), config.biddingRules as IBiddingRules);
  }
  return calculator;
}

export function getCalculatorData(): BiddingCalculatorData {
  calculatorData ??= new BiddingCalculatorData(getMainchain());
  return calculatorData;
}
