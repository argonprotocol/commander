import { beforeEach, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

vi.mock('../lib/SSH', async () => {
  const { sshMockFn } = await import('./helpers/ssh');
  return sshMockFn();
});

import { InstallerCheck } from '../lib/InstallerCheck';
import { Config } from '../lib/Config';
import { createMockedDbPromise } from './helpers/db';
import { InstallStepKey, InstallStepStatus } from '../interfaces/IConfig';

it.only('jump through the install steps rapidly when time has expired', async () => {
  const dbPromise = createMockedDbPromise({ isServerConnected: 'false' });
  const config = new Config(dbPromise);
  await config.load();

  const installerCheck = new InstallerCheck(config);
  const filenames: string[] = [];

  // @ts-ignore
  installerCheck.fetchLogFilenames = vi.fn(() => Promise.resolve(filenames));

  for (const stepKey of Object.values(InstallStepKey)) {
    let cycleCount = stepKey === InstallStepKey.ServerConnect ? 0 : 1;
    while (config.installDetails[stepKey].status !== InstallStepStatus.Completed) {
      const currentStep = config.installDetails[stepKey];
      if (currentStep.startDate) {
        currentStep.startDate = dayjs.utc().subtract(1, 'hour').toISOString();
      }

      cycleCount++;

      if (stepKey === InstallStepKey.ServerConnect) {
        const nextStepKey = InstallStepKey.FileCheck;
        filenames.push(`${nextStepKey}.started`, `${nextStepKey}.log`, `${nextStepKey}.finished`);
      } else {
        filenames.push(`${stepKey}.started`, `${stepKey}.log`, `${stepKey}.finished`);
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
