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
      if (command === 'fetch_security') {
        return {
          masterMnemonic: mnemonicGenerate(),
          sshPublicKey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC7',
          sshPrivateKey: ``,
        };
      }
      return Promise.resolve();
    }),
  };
});

it('can load config defaults', async () => {
  const dbPromise = createMockedDbPromise();
  const config = new Config(dbPromise);
  await config.load();
  expect(config.isServerReadyToInstall).toBe(false);
  expect(config.isServerInstalled).toBe(false);
  expect(config.isServerUpToDate).toBe(false);
  expect(config.isWaitingForUpgradeApproval).toBe(false);
  expect(config.hasMiningSeats).toBe(false);
  expect(config.hasMiningBids).toBe(false);
  expect(config.biddingRules).toBeTruthy();
});

it('can load config from db state', async () => {
  const dbPromise = createMockedDbPromise({ isServerInstalled: 'true' });
  const config = new Config(dbPromise);
  await config.load();
  expect(config.isServerInstalled).toBe(true);
});
