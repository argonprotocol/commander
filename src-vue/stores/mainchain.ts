import { Mainchain, MainchainClient } from '@argonprotocol/commander-calculator';
import { getClient } from '@argonprotocol/mainchain';
import { NETWORK_URL } from '../lib/Config';

let client: Promise<MainchainClient>;

export function getMainchainClient(): Promise<MainchainClient> {
  if (!client) {
    client = getClient(NETWORK_URL);
  }
  return client;
}

let mainchain: Mainchain;
export function getMainchain(): Mainchain {
  mainchain ??= new Mainchain(getMainchainClient());
  return mainchain;
}
