import {
  BiddingCalculator,
  BiddingCalculatorData,
  Mainchain,
  MainchainClient,
  MainchainClients,
} from '@argonprotocol/commander-core';
import { NETWORK_URL } from '../lib/Env.ts';
import { useConfig } from './config';
import { type IBiddingRules } from '@argonprotocol/commander-core/src/IBiddingRules.ts';
import { ApiDecoration } from '@polkadot/api/types';
import { botEmitter } from '../lib/Bot.ts';
import { BotStatus } from '../lib/BotSyncer.ts';
import { useBot } from './bot.ts';

let mainchainClients: MainchainClients;
let mainchain: Mainchain;
let calculator: BiddingCalculator;
let calculatorData: BiddingCalculatorData;

export async function getMainchainClientAt(
  height: number,
  isPriorToFinalizedHeight: boolean = true,
): Promise<ApiDecoration<'promise'>> {
  const client = await getMainchainClients().get(isPriorToFinalizedHeight);
  const blockHash = await client.rpc.chain.getBlockHash(height);
  return client.at(blockHash);
}
export function getMainchainClient(needsHistoricalAccess: boolean): Promise<MainchainClient> {
  return getMainchainClients().get(needsHistoricalAccess);
}

export function setArchiveClientUrl(url: string) {
  const clients = getMainchainClients();
  return clients.setArchiveClient(url);
}

function setPrunedClientToLocal() {
  if (!mainchainClients) {
    return;
  }
  const config = useConfig();
  if (config.isLoaded) {
    void mainchainClients.setPrunedClient(`ws://${config.serverDetails.ipAddress}:9944`);
  }
}

export function getMainchainClients(): MainchainClients {
  if (!mainchainClients) {
    mainchainClients = new MainchainClients(NETWORK_URL);

    const bot = useBot();
    if (bot.isReady) {
      setPrunedClientToLocal();
    }

    botEmitter.on('status-changed', status => {
      if (status === BotStatus.Ready && !mainchainClients.prunedClientPromise) {
        setPrunedClientToLocal();
      }
    });
  }

  return mainchainClients;
}

export function getMainchain(): Mainchain {
  if (!mainchain) {
    mainchain = new Mainchain(getMainchainClients());
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
