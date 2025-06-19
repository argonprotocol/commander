import { afterAll, afterEach, expect, it, vi } from 'vitest';

vi.mock('../lib/SSH', async () => {
  const { sshMockFn } = await import('./helpers/ssh');
  return sshMockFn();
});

import { Config } from '../lib/Config';
import { IConfigStringified } from '../interfaces/IConfig';
import { Db } from '../lib/Db';

async function createDbPromise(allAsObject: { [key: string]: string } = {}): Promise<Db> {
  return {
    configTable: {
      fetchAllAsObject: async () => allAsObject,
      insertOrReplace: async (obj: Partial<IConfigStringified>) => {},
    },
  } as unknown as Db;
}

it.only('can load config defaults', async () => {
  const dbPromise = createDbPromise();
  const config = new Config(dbPromise);
  await config.load();
  expect(config.isServerConnected).toBe(false);
  expect(config.isServerInstalled).toBe(false);
  expect(config.isServerUpToDate).toBe(false);
  expect(config.isServerReadyForBidding).toBe(false);
  expect(config.isWaitingForUpgradeApproval).toBe(false);
  expect(config.hasMiningSeats).toBe(false);
  expect(config.hasMiningBids).toBe(false);
  expect(config.biddingRules).toBe(null);
});

it('can load config from db state', async () => {
  const dbPromise = createDbPromise({ isServerInstalled: 'true' });
  const config = new Config(dbPromise);
  await config.load();
  expect(config.isServerInstalled).toBe(true);
});
