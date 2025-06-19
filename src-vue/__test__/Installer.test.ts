import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('../lib/SSH', async () => {
  const { sshMockFn } = await import('./helpers/ssh');
  return sshMockFn();
});

import { Db } from '../lib/Db';
import Installer, { resetInstaller } from '../lib/Installer';
import { Config } from '../lib/Config';
import { IConfigStringified } from '../interfaces/IConfig';

beforeEach(() => {
  resetInstaller();
});

async function createDbPromise(allAsObject: { [key: string]: string } = {}): Promise<Db> {
  return {
    configTable: {
      fetchAllAsObject: async () => allAsObject,
      insertOrReplace: async (obj: Partial<IConfigStringified>) => {},
    },
  } as unknown as Db;
}

it('should skip install if server is not connected', async () => {
  const dbPromise = createDbPromise({ isServerConnected: 'false' });
  const config = new Config(dbPromise);
  await config.load();

  const installer = new Installer(config);
  await installer.load();
  const didRun = await installer.run();

  expect(didRun).toBe(false);
  expect(installer.reasonToSkipInstall).toBe('ServerNotConnected');
});

it('should skip install if local files are invalid', async () => {
  const dbPromise = createDbPromise({ isServerConnected: 'true' });
  const config = new Config(dbPromise);
  await config.load();

  const installer = new Installer(config);
  await installer.load();
  // @ts-ignore
  installer.doLocalFilesMatchLocalShasums = vi.fn().mockReturnValue(false);
  const didRun = await installer.run();

  expect(didRun).toBe(false);
  expect(installer.reasonToSkipInstall).toBe('LocalShasumsNotAccurate');
});

it('should skip install if install is already running', async () => {
  const dbPromise = createDbPromise({ isServerConnected: 'true' });
  const config = new Config(dbPromise);
  await config.load();

  const installer = new Installer(config);
  await installer.load();
  installer.isRunning = true;
  const didRun = await installer.run();

  expect(didRun).toBe(false);
});

it('should install if all conditions are met', async () => {
  const dbPromise = createDbPromise({});
  const config = new Config(dbPromise);
  await config.load();

  const installer = new Installer(config);
  await installer.load();

  config.isServerConnected = true;
  config.isServerInstalled = false;
  config.isServerUpToDate = false;
  config.serverDetails = {
    ...config.serverDetails,
    ipAddress: '127.0.0.1',
  };
  await config.save();

  // @ts-ignore
  installer.doLocalFilesMatchLocalShasums = vi.fn().mockResolvedValue(true);
  // @ts-ignore
  installer.doRemoteFilesMatchLocalShasums = vi.fn().mockResolvedValue(true);
  // @ts-ignore
  installer.calculateIsRunning = vi.fn().mockResolvedValue(false);
  // @ts-ignore
  installer.startInstallSteps = vi.fn().mockResolvedValue();

  installer.isRunning = false;

  const didRun = await installer.run();

  expect(didRun).toBe(true);
});
