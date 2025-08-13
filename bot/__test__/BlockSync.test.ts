import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { runOnTeardown, sudo, teardown, startNetwork } from '@argonprotocol/testing';
import { AccountMiners, Accountset, getClient, mnemonicGenerate } from '@argonprotocol/mainchain';
import { BlockSync } from '../src/BlockSync.js';
import fs from 'node:fs';
import { Storage } from '../src/Storage.js';
import type { IBotSyncStatus } from '../src/interfaces/IBotStateFile.js';
import { Dockers } from '../src/Dockers.js';

afterEach(teardown);
afterAll(teardown);

let clientAddress: string;
beforeAll(async () => {
  const result = await startNetwork();
  clientAddress = result.archiveUrl;
});

it('can backfill sync data', async () => {
  const client = await getClient(clientAddress);

  const botDataDir = fs.mkdtempSync('/tmp/block-sync-');
  runOnTeardown(() => fs.promises.rm(botDataDir, { recursive: true, force: true }));

  const botStatus = <IBotSyncStatus>{
    isReady: false,
  };
  const storage = new Storage(botDataDir);
  const accountset = new Accountset({
    client: Promise.resolve(client),
    seedAccount: sudo(),
    sessionKeySeedOrMnemonic: mnemonicGenerate(),
    subaccountRange: new Array(99).fill(0).map((_, i) => i),
  });
  const blockSync = new BlockSync(botStatus, accountset, storage, client, client, 0);
  blockSync.accountMiners = new AccountMiners(accountset, []);

  const blockNumber = await new Promise<number>(async resolve => {
    const unsub = await client.query.system.number(x => {
      if (x.toNumber() >= 20) {
        resolve(x.toNumber());
        unsub();
      }
    });
  });

  vi.spyOn(Dockers, 'getArgonBlockNumbers').mockImplementation(async () => {
    return {
      localNode: 0,
      mainNode: 0,
    };
  });
  vi.spyOn(Dockers, 'getBitcoinBlockNumbers').mockImplementation(async () => {
    return {
      localNode: 0,
      mainNode: 0,
    };
  });
  const finalized = await client.rpc.chain.getFinalizedHead();
  const finalizedHeader = await client.rpc.chain.getHeader(finalized);
  const latest = await client.rpc.chain.getHeader();
  const bestBlock = latest.number.toNumber();
  expect(bestBlock).gte(blockNumber);
  blockSync.latestFinalizedBlockNumber = finalizedHeader.number.toNumber();
  const result = await blockSync.backfillBestBlockHeader(latest);
  expect(result).toBeDefined();
  expect(result!.finalizedBlockNumber).toBeGreaterThanOrEqual(finalizedHeader.number.toNumber());
  expect(result!.bestBlockNumber).toBeGreaterThanOrEqual(latest.number.toNumber());
  expect(result!.syncedToBlockNumber).toBe(0);
  for (let i = 1; i <= blockNumber; i++) {
    const block = result!.blocksByNumber[i];
    expect(block).toBeDefined();
    expect(block!.number).toBe(i);
    expect(block!.hash).toBeDefined();
  }

  await expect(blockSync.processNext()).resolves.toStrictEqual({
    processed: expect.objectContaining({
      number: 1,
    }),
    remaining: result!.bestBlockNumber - 1,
  });

  await expect(blockSync.syncToLatest()).resolves.toBeUndefined();
  const status = await blockSync.state();
  expect(status.syncedToBlockNumber).toBeGreaterThanOrEqual(result!.bestBlockNumber);
  expect(status.syncProgress).toBe(100);
});
