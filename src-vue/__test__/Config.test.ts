import { afterAll, afterEach, expect, it, vi } from 'vitest';

vi.mock('../lib/SSH', async () => {
  const { sshMockFn } = await import('./helpers/ssh');
  return sshMockFn();
});

import { Config } from '../lib/Config';
import { createMockedDbPromise } from './helpers/db';

it.only('can load config defaults', async () => {
  const dbPromise = createMockedDbPromise();
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
  const dbPromise = createMockedDbPromise({ isServerInstalled: 'true' });
  const config = new Config(dbPromise);
  await config.load();
  expect(config.isServerInstalled).toBe(true);
});
