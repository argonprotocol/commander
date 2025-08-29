import { expect, it, vi } from 'vitest';
import { Config } from '../lib/Config';
import { createMockedDbPromise } from './helpers/db';
import { mnemonicGenerate } from '@argonprotocol/mainchain';

vi.mock('../lib/SSH', async () => {
  const { sshMockFn } = await import('./helpers/ssh');
  return sshMockFn();
});

vi.mock('../lib/tauriApi', async () => {
  return {
    invokeWithTimeout: vi.fn((command: string, args: any) => {
      console.log('invokeWithTimeout', command, args);

      return Promise.resolve();
    }),
  };
});

it('can load config defaults', async () => {
  const dbPromise = createMockedDbPromise();
  const config = new Config(dbPromise);
  await config.load();
  expect(config.isMinerReadyToInstall).toBe(false);
  expect(config.isMinerInstalled).toBe(false);
  expect(config.isMinerUpToDate).toBe(false);
  expect(config.isMinerWaitingForUpgradeApproval).toBe(false);
  expect(config.hasMiningSeats).toBe(false);
  expect(config.hasMiningBids).toBe(false);
  expect(config.biddingRules).toBeTruthy();
});

it('can load config from db state', async () => {
  const dbPromise = createMockedDbPromise({ isMinerInstalled: 'true' });
  const config = new Config(dbPromise);
  await config.load();
  expect(config.isMinerInstalled).toBe(true);
});
