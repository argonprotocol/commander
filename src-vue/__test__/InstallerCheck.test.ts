import { expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

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

      return Promise.resolve();
    }),
  };
});

import { InstallerCheck } from '../lib/InstallerCheck';
import { Config } from '../lib/Config';
import { createMockedDbPromise } from './helpers/db';
import { InstallStepKey, InstallStepStatus } from '../interfaces/IConfig';
import Installer from '../lib/Installer';
import { IInstallStepStatuses, InstallStepStatusType } from '../lib/Server';
import { mnemonicGenerate } from '@argonprotocol/mainchain';

it.only('jump through the install steps rapidly when time has expired', async () => {
  const dbPromise = createMockedDbPromise({ isServerReadyToInstall: 'false' });
  const config = new Config(dbPromise);
  await config.load();

  const installer = new Installer(config);
  const installerCheck = new InstallerCheck(installer, config);
  const installStepStatuses: IInstallStepStatuses = {};

  // @ts-ignore
  installerCheck.fetchInstallStepStatuses = vi.fn(() => Promise.resolve(installStepStatuses));

  for (const stepKey of Object.values(InstallStepKey)) {
    let cycleCount = stepKey === InstallStepKey.ServerConnect ? 0 : 1;
    while (config.installDetails[stepKey].status !== InstallStepStatus.Completed) {
      const currentStep = config.installDetails[stepKey];
      if (currentStep.startDate) {
        currentStep.startDate = dayjs.utc().subtract(1, 'hour').toISOString();
      }

      cycleCount++;

      if (stepKey === InstallStepKey.ServerConnect) {
        const nextStepKey = InstallStepKey.FileUpload;
        installStepStatuses[nextStepKey] = InstallStepStatusType.Started;
      } else {
        installStepStatuses[stepKey] = InstallStepStatusType.Finished;
      }

      const statusBeforeUpdate = config.installDetails[stepKey].status;
      await installerCheck.updateInstallStatus();
      const statusAfterUpdate = config.installDetails[stepKey].status;

      if (cycleCount === 1) {
        expect(statusBeforeUpdate).toBe(InstallStepStatus.Pending);
        expect(statusAfterUpdate).toBe(InstallStepStatus.Working);
      } else if (cycleCount === 2) {
        expect(statusBeforeUpdate).toBe(InstallStepStatus.Working);
        expect(statusAfterUpdate).toBe(InstallStepStatus.Completing);
      } else if (cycleCount === 3) {
        expect(statusBeforeUpdate).toBe(InstallStepStatus.Completing);
        expect(statusAfterUpdate).toBe(InstallStepStatus.Completed);
      }
      expect(cycleCount).toBeLessThan(4);
    }
  }

  expect(installerCheck.isServerInstallComplete).toBe(true);
});
