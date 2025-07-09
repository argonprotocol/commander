import BiddingCalculator, {
  BiddingCalculatorData,
  Mainchain,
  MainchainClient,
} from '@argonprotocol/commander-calculator';
import { getClient } from '@argonprotocol/mainchain';
import { NETWORK_URL } from '../lib/Config';

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

export function getMainchain(): Mainchain {
  mainchain ??= new Mainchain(getMainchainClient());
  return mainchain;
}

export function getCalculator(): BiddingCalculator {
  calculator ??= new BiddingCalculator(getCalculatorData());
  return calculator;
}

export function getCalculatorData(): BiddingCalculatorData {
  calculatorData ??= new BiddingCalculatorData(getMainchain());
  return calculatorData;
}
