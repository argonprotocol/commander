import BiddingCalculator, {
  BiddingCalculatorData,
  Mainchain,
  MainchainClient,
} from '@argonprotocol/commander-calculator';
import { getClient } from '@argonprotocol/mainchain';
import { NETWORK_URL } from '../lib/Config';
import { useConfig } from './config';
import { type IBiddingRules } from '@argonprotocol/commander-calculator/src/IBiddingRules.ts';

let client: Promise<MainchainClient>;
let mainchain: Mainchain;
let calculator: BiddingCalculator;
let calculatorData: BiddingCalculatorData;

export function getMainchainClient(): Promise<MainchainClient> {
  if (!client) {
    client = getClient(NETWORK_URL);
  }
  return client;
}

export function setMainchainClient(newClient: Promise<MainchainClient>) {
  client = newClient;
}

export function getMainchain(): Mainchain {
  mainchain ??= new Mainchain(getMainchainClient());
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
