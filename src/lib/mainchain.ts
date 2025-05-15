import { Mainchain, MainchainClient } from '@argonprotocol/bidding-calculator';
import { getClient } from '@argonprotocol/mainchain';
import { invoke } from '@tauri-apps/api/core';

let client: Promise<MainchainClient>;

export async function getMainchainClient(): Promise<MainchainClient> {
  if (!client) {
    const mainchainUrl = await invoke<string>('get_mainchain_url');
    client = getClient(mainchainUrl);
  }
  return client;
}

let mainchain: Mainchain;
export function getMainchain(): Mainchain {
  mainchain ??= new Mainchain(getMainchainClient());
  return mainchain;
}
