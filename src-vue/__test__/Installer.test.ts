import { beforeEach, expect, it, vi } from 'vitest';
import * as Vue from 'vue';

vi.mock('../lib/SSH', async () => {
  const { sshMockFn } = await import('./helpers/ssh');
  return sshMockFn();
});

vi.mock('@tauri-apps/plugin-dialog', async () => {
  return {
    message: vi.fn(),
  };
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
import Installer, { resetInstaller } from '../lib/Installer';
import { Config } from '../lib/Config';
import { createMockedDbPromise } from './helpers/db';
import { IInstallStepStatuses, InstallStepStatusType } from '../lib/Server';
import { InstallStepKey } from '../interfaces/IConfig';
import { mnemonicGenerate } from '@argonprotocol/mainchain';

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
  installer.isRemoteVersionLatest = vi.fn().mockResolvedValue(true);
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
  installer.isRemoteVersionLatest = vi.fn().mockResolvedValue(true);
  // @ts-ignore

  const installStepStatusPending: [InstallStepKey, InstallStepStatusType][] = [
    [InstallStepKey.FileUpload, InstallStepStatusType.Finished],
    [InstallStepKey.UbuntuCheck, InstallStepStatusType.Finished],
    [InstallStepKey.DockerInstall, InstallStepStatusType.Finished],
    [InstallStepKey.ArgonInstall, InstallStepStatusType.Finished],
    [InstallStepKey.BitcoinInstall, InstallStepStatusType.Finished],
    [InstallStepKey.MiningLaunch, InstallStepStatusType.Finished],
  ];
  const installStepStatusCompleted: IInstallStepStatuses = {};

  // @ts-ignore
  installer.installerCheck.fetchInstallStepStatuses = vi.fn(() => {
    if (installStepStatusPending.length) {
      const nextFiles = installStepStatusPending.splice(0, 2);
      for (const [key, status] of nextFiles) {
        installStepStatusCompleted[key] = status;
      }
    }
    return installStepStatusCompleted;
  });

  await installer.load();
  await installer.run();

  expect(config.installDetails.ServerConnect.status).toBe('Completed');
});
