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

  setArchiveClient(url: string) {
    if (this.archiveUrl === url) {
      return; // No change, do nothing
    }
    this.archiveUrl = url;
    this.archiveClientPromise = getMainchainClientOrThrow(url).then(x => wrapApi(x, 'ARCHIVE_RPC'));
    return this.archiveClientPromise;
  }

  setPrunedClient(url: string): Promise<ArgonClient> {
    if (this.prunedUrl === url && this.prunedClientPromise) {
      return this.prunedClientPromise;
    }
    this.prunedUrl = url;
    this.prunedClientPromise ??= getMainchainClientOrThrow(url).then(client => wrapApi(client, 'PRUNED_RPC'));
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
