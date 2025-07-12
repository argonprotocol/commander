import { SSH } from './SSH';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import {
  IConfigInstallDetails,
  IConfigInstallStep,
  InstallStepErrorType,
  InstallStepStatus,
  InstallStepKey,
} from '../interfaces/IConfig';
import { Config } from './Config';
import Installer from './Installer';

dayjs.extend(utc);

export class InstallerCheck {
  public shouldUseCachedFilenames = false;
  private hasCachedFilenames = false;

  private installer: Installer;
  private config: Config;
  private cachedFilenames: string[] = [];
  private isCompletedPromise: Promise<void> | null = null;

  constructor(installer: Installer, config: Config) {
    this.installer = installer;
    this.config = config;
  }

  public start(): void {
    this.isCompletedPromise = new Promise(async (resolve, reject) => {
      while (true) {
        await this.updateInstallStatus();
        if (this.hasError) {
          reject(new Error('Install process has error'));
          return;
        }

        if (this.isServerInstallComplete) {
          resolve();
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    });
  }

  public async waitForInstallToComplete(): Promise<void> {
    await this.isCompletedPromise;
  }

  public get hasError(): boolean {
    return this.config.installDetails.errorType !== null;
  }

  public get isServerInstallComplete(): boolean {
    return (
      this.config.installDetails.UbuntuCheck.progress >= 100 &&
      this.config.installDetails.FileUpload.progress >= 100 &&
      this.config.installDetails.DockerInstall.progress >= 100 &&
      this.config.installDetails.BitcoinInstall.progress >= 100 &&
      this.config.installDetails.ArgonInstall.progress >= 100 &&
      this.config.installDetails.MiningLaunch.progress >= 100.0
    );
  }

  public async updateInstallStatus(): Promise<void> {
    const filenames = await this.fetchLogFilenames();
    const installDetailsPending = Config.getDefault('installDetails') as IConfigInstallDetails;

    const stepsToProcess: Record<InstallStepKey, number> = {
      [InstallStepKey.ServerConnect]: 0.2,
      [InstallStepKey.FileUpload]: 1,
      [InstallStepKey.UbuntuCheck]: 1,
      [InstallStepKey.DockerInstall]: 5,
      [InstallStepKey.BitcoinInstall]: 10,
      [InstallStepKey.ArgonInstall]: 10,
      [InstallStepKey.MiningLaunch]: 0,
    };

    let prevStep: IConfigInstallStep | null = null;

    for (const [stepKey, estimatedMinutes] of Object.entries(stepsToProcess) as [InstallStepKey, number][]) {
      const stepNewData = installDetailsPending[stepKey] as IConfigInstallStep;
      const stepOldData = this.config.installDetails[stepKey] as IConfigInstallStep;
      const prevStepHasCompleted = !prevStep || prevStep.status === InstallStepStatus.Completed;
      const statusOnServer = this.extractFilenameStatus(stepKey, stepOldData, filenames);

      if (installDetailsPending.errorType) {
        stepNewData.status = InstallStepStatus.Hidden;
      } else if (prevStepHasCompleted && statusOnServer === 'Finished') {
        stepNewData.startDate = stepOldData.startDate || dayjs.utc().toISOString();
        stepNewData.progress = stepOldData.progress;
        if (this.installer.isRunning) {
          stepNewData.progress = await InstallerCheck.calculateFinishedStepProgress(stepNewData);
        }
        if (stepNewData.progress >= 100 && stepOldData.status === InstallStepStatus.Working) {
          stepNewData.status = InstallStepStatus.Completing;
        } else if (stepNewData.progress >= 100) {
          stepNewData.status = InstallStepStatus.Completed;
        } else {
          stepNewData.status = InstallStepStatus.Working;
        }
      } else if (prevStepHasCompleted && statusOnServer === 'Failed') {
        stepNewData.status = InstallStepStatus.Failed;
        stepNewData.progress = stepOldData.progress;
        installDetailsPending.errorType = stepKey as unknown as InstallStepErrorType;
      } else if (prevStepHasCompleted && this.installer.isRunning) {
        stepNewData.status = InstallStepStatus.Working;
        stepNewData.startDate = stepOldData.startDate || dayjs.utc().toISOString();
        stepNewData.progress = stepOldData.progress;
        stepNewData.progress = await this.calculateWorkingStepProgress(stepKey, stepNewData, estimatedMinutes);
      } else if (prevStepHasCompleted) {
        Object.assign(stepNewData, stepOldData);
      } else {
        stepNewData.status = InstallStepStatus.Pending;
        stepNewData.progress = 0;
      }

      if (stepNewData.progress >= 100 && stepNewData.status !== InstallStepStatus.Completed) {
        stepNewData.status = InstallStepStatus.Completing;
      }

      prevStep = stepNewData;
    }

    this.config.installDetails = installDetailsPending;
    if (this.isServerInstallComplete) {
      this.config.isServerInstalled = true;
      this.config.isServerUpToDate = true;
    }
    await this.config.save();
  }

  public clearCachedFilenames(): void {
    this.cachedFilenames = [];
  }

  private extractFilenameStatus(
    stepName: InstallStepKey,
    stepOldData: IConfigInstallStep,
    filenames: String[],
  ): 'Pending' | 'Started' | 'Finished' | 'Failed' {
    const isServerConnectStep = stepName === InstallStepKey.ServerConnect;
    if (isServerConnectStep) {
      const nextStepHasStarted = this.installer.fileUploadProgress > 0;
      if (stepOldData.progress >= 100 || nextStepHasStarted) {
        return 'Finished';
      } else {
        return 'Started';
      }
    }

    if (filenames.includes(`${stepName}.finished`)) {
      return 'Finished';
    } else if (filenames.includes(`${stepName}.failed`)) {
      return 'Failed';
    } else if (filenames.includes(`${stepName}.started`)) {
      return 'Started';
    }
    return 'Pending';
  }

  private async calculateWorkingStepProgress(
    stepName: InstallStepKey,
    stepPending: IConfigInstallStep,
    estimatedMinutes: number,
  ): Promise<number> {
    if (stepName === InstallStepKey.MiningLaunch) {
      const progress = await InstallerCheck.fetchMiningLaunchProgress();
      console.log('MiningLaunch PROGRESS', progress);
      return progress;
    } else if (stepName === InstallStepKey.FileUpload) {
      return this.installer.fileUploadProgress;
    }

    const startDate = dayjs.utc(stepPending.startDate);
    return InstallerCheck.calculateStepProgress(startDate, estimatedMinutes);
  }

  private static async calculateFinishedStepProgress(stepPending: IConfigInstallStep): Promise<number> {
    const desiredMinutes = 0.0166; // 1 second
    const startDate = dayjs.utc(stepPending.startDate);
    const progress = this.calculateStepProgress(startDate, desiredMinutes);
    return progress;
  }

  private static calculateStepProgress(startDate: Dayjs, desiredMinutes: number): number {
    const now = dayjs.utc();
    const desiredMilliseconds = desiredMinutes * 60 * 1000;
    const elapsedMilliseconds = now.diff(startDate, 'milliseconds');
    let progress = Math.round((elapsedMilliseconds / desiredMilliseconds) * 10_000) / 100;
    progress = Math.min(progress, 100);
    progress = Math.max(progress, 0.01);

    return progress;
  }

  private static async fetchMiningLaunchProgress(): Promise<number> {
    // Run commands sequentially instead of concurrently
    const [argonOutput] = await SSH.runCommand('docker exec deploy-argon-miner-1 syncstatus.sh');
    const [bitcoinOutput] = await SSH.runCommand('docker exec deploy-bitcoin-1 syncstatus.sh');

    console.log('MiningLaunch PROGRESS', 'argonOutput:', argonOutput, 'bitcoinOutput:', bitcoinOutput);

    const argonProgress = parseFloat(argonOutput.trim().replace('%', '')) || 0.0;
    const bitcoinProgress = parseFloat(bitcoinOutput.trim().replace('%', '')) || 0.0;
    const progress = (argonProgress + bitcoinProgress) / 2.0;

    return progress;
  }

  private async fetchLogFilenames(): Promise<string[]> {
    if (this.hasCachedFilenames && this.shouldUseCachedFilenames) {
      return this.cachedFilenames;
    }

    try {
      const [output, code] = await SSH.runCommand('ls ~/install-logs');
      if (code === 0) {
        this.cachedFilenames = output.split('\n').filter(s => s);
      } else {
        console.error('Failed to fetch log filenames', output);
      }
      this.hasCachedFilenames = true;
      return this.cachedFilenames;
    } catch {
      return [];
    }
  }
}
