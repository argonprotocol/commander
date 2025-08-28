import './helpers/mocks.ts';
import { expect, it } from 'vitest';
import { Config } from '../lib/Config';
import { createMockedDbPromise } from './helpers/db';
import { instanceChecks } from '../lib/Utils.js';

it('can load config defaults', async () => {
  const dbPromise = createMockedDbPromise();
  instanceChecks.delete(Config.prototype.constructor);
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
  instanceChecks.delete(Config.prototype.constructor);
  const config = new Config(dbPromise);
  await config.load();
  expect(config.isMinerInstalled).toBe(true);
});
