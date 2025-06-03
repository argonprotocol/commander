import { Mainchain, MainchainClient } from '@argonprotocol/commander-calculator';
import { getClient } from '@argonprotocol/mainchain';

let client: Promise<MainchainClient>;

export function getMainchainClient(): Promise<MainchainClient> {
  if (!client) {
    const mainchainUrl = import.meta.env.VITE_MAINCHAIN_URL || 'wss://rpc.argon.network';
    client = getClient(mainchainUrl);
  }
  return client;
}

let mainchain: Mainchain;
export function getMainchain(): Mainchain {
  mainchain ??= new Mainchain(getMainchainClient());
  return mainchain;
}
