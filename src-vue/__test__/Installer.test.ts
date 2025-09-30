import './helpers/mocks.ts';
import { beforeEach, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import { Config } from '../lib/Config';
import Installer, { resetInstaller } from '../lib/Installer';
import { createMockedDbPromise } from './helpers/db';
import { IInstallStepStatuses, InstallStepStatusType } from '../lib/Server';
import { InstallStepKey } from '../interfaces/IConfig';
import { InstallerCheck } from '../lib/InstallerCheck.ts';

beforeEach(() => {
  resetInstaller();
  // @ts-expect-error - mock
  Config.prototype._didWalletHavePreviousLife = vi.fn().mockResolvedValue(false);
});

it('should skip install if server is not connected', async () => {
  const dbPromise = createMockedDbPromise({ isMinerReadyToInstall: 'false' });
  const config = new Config(dbPromise);
  await config.load();

  const installer = new Installer(config);
  await installer.load();
  // @ts-expect-error - test private method
  const didRun = await installer.calculateIsReadyToRun();

  expect(didRun).toBe(false);
  expect(installer.reasonToSkipInstall).toBe('ServerNotConnected');
});

it('should skip install if install is already running', async () => {
  const dbPromise = createMockedDbPromise({ isMinerReadyToInstall: 'true' });
  const config = new Config(dbPromise);
  await config.load();

  const installer = new Installer(config);
  await installer.load();
  installer.isRunning = true;
  // @ts-expect-error - test private method
  const didRun = await installer.calculateIsReadyToRun();

  expect(didRun).toBe(true);
  expect(installer.reasonToSkipInstall).toBe('');
});

it('should install if all conditions are met', async () => {
  const dbPromise = createMockedDbPromise({});
  const config = new Config(dbPromise);
  await config.load();

  const installer = new Installer(config);
  await installer.load();

  config.isMinerReadyToInstall = true;
  config.isMinerInstalled = false;
  config.isMinerUpToDate = false;
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

  // @ts-expect-error - test private method
  const didRun = await installer.calculateIsReadyToRun();

  expect(didRun).toBe(true);
});

it('should run through entire install process', async () => {
  const dbPromise = createMockedDbPromise({ isMinerReadyToInstall: 'true' });
  const config = Vue.reactive(new Config(dbPromise)) as Config;
  await config.load();

  const installer = new Installer(config);

  // @ts-ignore
  installer.isRemoteVersionLatest = vi.fn().mockResolvedValue(true);
  // @ts-ignore

  const installStepStatusPending: [InstallStepKey, InstallStepStatusType][] = [
    [InstallStepKey.ServerConnect, InstallStepStatusType.Finished],
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
  // @ts-ignore
  InstallerCheck.calculateFinishedStepProgress = vi.fn().mockResolvedValue(100);
  // @ts-ignore
  installer.installerCheck.checkInterval = 1;
  // @ts-ignore
  installer.getLocalShasum = vi.fn().mockResolvedValue('dummy-sha256');

  const uploadMock = vi.fn().mockImplementation(() => Promise.resolve());
  // @ts-ignore
  installer.uploadCoreFiles = uploadMock;

  // should call run
  await installer.load();

  expect(config.installDetails.ServerConnect.status).toBe('Completed');
  expect(uploadMock).toHaveBeenCalledTimes(1);
});
