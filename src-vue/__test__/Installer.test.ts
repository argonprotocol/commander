import { beforeEach, expect, it, vi } from 'vitest';
import * as Vue from 'vue';

vi.mock('../lib/SSH', async () => {
  const { sshMockFn } = await import('./helpers/ssh');
  return sshMockFn();
});

import Installer, { resetInstaller } from '../lib/Installer';
import { Config } from '../lib/Config';
import { createMockedDbPromise } from './helpers/db';

beforeEach(() => {
  resetInstaller();
});

it('should skip install if server is not connected', async () => {
  const dbPromise = createMockedDbPromise({ isServerReadyToInstall: 'false' });
  const config = new Config(dbPromise);
  await config.load();

  const installer = new Installer(config);
  await installer.load();
  const didRun = await installer.run();

  expect(didRun).toBe(false);
  expect(installer.reasonToSkipInstall).toBe('ServerNotConnected');
});

it('should skip install if local files are invalid', async () => {
  const dbPromise = createMockedDbPromise({ isServerReadyToInstall: 'true' });
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
  const dbPromise = createMockedDbPromise({ isServerReadyToInstall: 'true' });
  const config = new Config(dbPromise);
  await config.load();

  const installer = new Installer(config);
  await installer.load();
  installer.isRunning = true;
  const didRun = await installer.run();

  expect(didRun).toBe(false);
});

it('should install if all conditions are met', async () => {
  const dbPromise = createMockedDbPromise({});
  const config = new Config(dbPromise);
  await config.load();

  const installer = new Installer(config);
  await installer.load();

  config.isServerReadyToInstall = true;
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

it.only('should run through entire install process', async () => {
  const dbPromise = createMockedDbPromise({ isServerReadyToInstall: 'true' });
  const config = Vue.reactive(new Config(dbPromise)) as Config;
  await config.load();

  Vue.watch(
    () => config.installDetails,
    () => {
      console.log('installDetails changed', JSON.stringify(config.installDetails, null, 2));
    },
  );

  const installer = new Installer(config);

  // @ts-ignore
  installer.doLocalFilesMatchLocalShasums = vi.fn().mockResolvedValue(true);
  // @ts-ignore
  installer.doRemoteFilesMatchLocalShasums = vi.fn().mockResolvedValue(true);
  // @ts-ignore

  const filenamesPending = [
    'FileUpload.started',
    'FileUpload.finished',
    'FileUpload.log',
    'UbuntuCheck.started',
    'UbuntuCheck.finished',
    'UbuntuCheck.log',
    'DockerInstall.started',
    'DockerInstall.finished',
    'DockerInstall.log',
    'ArgonInstall.started',
    'ArgonInstall.finished',
    'ArgonInstall.log',
    'BitcoinInstall.started',
    'BitcoinInstall.finished',
    'BitcoinInstall.log',
    'MiningLaunch.started',
    'MiningLaunch.finished',
    'MiningLaunch.log',
  ];
  const filenamesCompleted: string[] = [];

  // @ts-ignore
  installer.installerCheck.fetchLogFilenames = vi.fn(() => {
    if (filenamesPending.length) {
      const nextFiles = filenamesPending.splice(0, 3);
      filenamesCompleted.push(...nextFiles);
    }
    return filenamesCompleted;
  });

  await installer.load();
  await installer.run();

  expect(config.installDetails.ServerConnect.status).toBe('Completed');
});
