import { type ArgonClient } from '@argonprotocol/mainchain';
import { wrapApi } from './ClientWrapper.js';
import type { MainchainClient } from './Mainchain.js';
import { ApiPromise, WsProvider } from '@polkadot/api';

export class MainchainClients {
  archiveUrl: string;
  archiveClientPromise: Promise<ArgonClient>;

  prunedUrl?: string;
  prunedClientPromise?: Promise<ArgonClient>;

  constructor(archiveUrl: string) {
    this.archiveUrl = archiveUrl;
    this.archiveClientPromise = getMainchainClientOrThrow(archiveUrl).then(x => wrapApi(x, 'ARCHIVE_RPC'));
  }

  async setArchiveClient(url: string) {
    if (this.archiveUrl === url) {
      try {
        await this.archiveClientPromise;
        return; // No change, do nothing
      } catch {
        // Previous connection failed, try to reconnect
      }
    }
    const client = getMainchainClientOrThrow(url).then(x => wrapApi(x, 'ARCHIVE_RPC'));
    this.archiveUrl = url;
    this.archiveClientPromise = client;
    return this.archiveClientPromise;
  }

  async setPrunedClient(url: string): Promise<ArgonClient> {
    if (this.prunedUrl === url && this.prunedClientPromise) {
      return this.prunedClientPromise;
    }
    const client = await getMainchainClientOrThrow(url).then(client => wrapApi(client, 'PRUNED_RPC'));
    this.prunedClientPromise = Promise.resolve(client);
    this.prunedUrl = url;
    return this.prunedClientPromise;
  }

  get(needsHistoricalBlocks: boolean): Promise<ArgonClient> {
    if (needsHistoricalBlocks) {
      return this.archiveClientPromise;
    }
    return this.prunedClientPromise ?? this.archiveClientPromise;
  }

  async disconnect() {
    await Promise.allSettled([
      this.archiveClientPromise.then(client => client.disconnect()),
      this.prunedClientPromise?.then(client => client.disconnect()),
    ]);
  }
}

async function getMainchainClientOrThrow(host: string): Promise<MainchainClient> {
  const provider = new WsProvider(host);
  return (await ApiPromise.create({ provider, noInitWarn: true, throwOnConnect: true })) as unknown as ArgonClient;
}
