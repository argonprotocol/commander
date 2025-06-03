import * as Vue from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import dayjs, { type Dayjs } from 'dayjs';
import { IStep, defaultSteps } from './InstallerStep';

export interface IInstallStatus {
  server: IInstallStatusServer;
  client: any;
}

export interface IInstallStatusServer {
  ServerConnect: number;
  UbuntuCheck: number;
  FileCheck: number;
  DockerInstall: number;
  BitcoinInstall: number;
  ArgonInstall: number;
  DockerLaunch: number;
  errorType: 'ServerConnect' | 'UbuntuCheck' | 'FileCheck' | 'DockerInstall' | 'BitcoinInstall' | 'ArgonInstall' | 'DockerLaunch' | 'Unknown' | '';
  errorMessage: string;
}

export type { IStep };

const SAVE_THROTTLE_INTERVAL: number = 10_000; // 10 seconds in milliseconds

export default class Installer {
  public isProvisioned = Vue.ref(false);
  public hasError = Vue.ref(false);
  public errorType = Vue.ref('');
  
  public finishedFn: (() => void) | null = null;

  private isRunning = false;
  private isRunningProgressCalculations = false;

  private startTimeOfStep: Dayjs | null = null;
  private currentStep: IStep | null = null;
  private lastFetchInstallStatus: number = 0;
  private hasPendingFetchInstallStatus: boolean = false;
  private saveTimeout: number | null = null;

  private installStatusServer: IInstallStatusServer;

  public steps: IStep[] = Vue.reactive(defaultSteps);

  constructor(installStatus: IInstallStatus, isInstallingFresh: boolean) {
    this.installStatusServer = installStatus.server;
    const fileCheckStep = this.steps.find(step => step.key === 'FileCheck');
    const fileCheckVerbs = isInstallingFresh ? ['Install', 'Installing', 'Installed'] : ['Update', 'Updating', 'Updated'];
    if (fileCheckStep) {
      fileCheckStep.labels[0] = fileCheckStep.templates?.[0].replace('{VERB}', fileCheckVerbs[0]) ?? fileCheckStep.labels[0];
      fileCheckStep.labels[1] = fileCheckStep.templates?.[1].replace('{VERB}', fileCheckVerbs[1]) ?? fileCheckStep.labels[1];
      fileCheckStep.labels[2] = fileCheckStep.templates?.[2].replace('{VERB}', fileCheckVerbs[2]) ?? fileCheckStep.labels[2];
    }
    this.start(installStatus.client);
  }

  public setIpAddress(ipAddress: string) {
    this.steps[0].labels[0] = `Connect to ${ipAddress}`;
    this.steps[0].labels[1] = `Connecting to ${ipAddress}`;
    this.steps[0].labels[2] = `Connected to ${ipAddress}`;
  }

  public async start(installStatusClient: any = {}) {
    this.isRunning = true;
    for (const [index, step] of Object.entries(this.steps)) {
      const lastIndex = Number(index) - 1;
      const lastStep = lastIndex >= 0 ? this.steps[lastIndex] : {} as any;

      if (installStatusClient[step.key]) {
        step.progress = installStatusClient[step.key];
      }

      if (['failed', 'hidden'].includes(lastStep.status)) {
        step.status = 'hidden';
      } else if (
        (step.key === 'ServerConnect' && this.installStatusServer.UbuntuCheck > 0) ||
        (step.key === 'UbuntuCheck' && this.installStatusServer.UbuntuCheck === 100) ||
        (step.key === 'FileCheck' && this.installStatusServer.FileCheck === 100) ||
        (step.key === 'DockerInstall' && this.installStatusServer.DockerInstall === 100) ||
        (step.key === 'BitcoinInstall' && this.installStatusServer.BitcoinInstall == 100) ||
        (step.key === 'ArgonInstall' && this.installStatusServer.ArgonInstall === 100) ||
        (step.key === 'DockerLaunch' && this.installStatusServer.DockerLaunch === 100)
      ) {
        step.status = 'completed';
        step.progress = 100;
        if (step.key === 'DockerLaunch') {
          this.isProvisioned.value = true;
        }
      } else if (this.installStatusServer.errorType) {
        step.status = 'failed';
        this.hasError.value = true;
        this.errorType.value = this.installStatusServer.errorType;
      }
    }

    this.isRunning = true;
    if (this.isProvisioned.value) {
      if (this.finishedFn) {
        this.finishedFn();
      }
    } else {
      await this.runProgressCalculations();
    }
  }

  public stop() {
    this.isRunning = false;
  }

  private async runProgressCalculations() {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunningProgressCalculations = true;
    this.throttleFetchInstallStatus();

    let currentStep = this.steps[0];
    
    for (const [index, step] of Object.entries(this.steps)) {
      const lastIndex = Math.max(Number(index) - 1, 0);
      const lastStep = this.steps[lastIndex];

      currentStep = step;

      if (step.progress === 100) {
        step.status = 'completed';
        continue;
      } else if (step.status === 'failed') {
        continue;
      }

      const fastStepIncrease = 0.20;
      const secondsSinceStepStarted = dayjs().diff(this.startTimeOfStep, 'seconds');

      if (['failed', 'hidden'].includes(lastStep.status)) {
        step.status = 'hidden';
        continue;
      }
      
      if (this.installStatusServer.errorType === step.key && secondsSinceStepStarted > 10) {
        step.status = 'failed';
        this.hasError.value = true;
        this.errorType.value = this.installStatusServer.errorType;
        continue;
      }

      step.status = 'working';

      let serverStepIsComplete = false;
      let stepIncrease = Math.max(0.02 - (0.08 * step.progress / 100), 0.0005);

      if (step.key === 'ServerConnect' && this.installStatusServer.UbuntuCheck > 0) {
        stepIncrease = fastStepIncrease * 2;
        serverStepIsComplete = true;
      } else if (step.key === 'UbuntuCheck' && this.installStatusServer.UbuntuCheck >= 100) {
        stepIncrease = fastStepIncrease;
        serverStepIsComplete = true;
      } else if (step.key === 'FileCheck' && this.installStatusServer.FileCheck >= 100) {
        stepIncrease = fastStepIncrease;
        serverStepIsComplete = true;
      } else if (step.key === 'DockerInstall' && this.installStatusServer.DockerInstall >= 100) {
        stepIncrease = fastStepIncrease;
        serverStepIsComplete = true;
      } else if (step.key === 'BitcoinInstall' && this.installStatusServer.BitcoinInstall >= 100) {
        stepIncrease = fastStepIncrease;
        serverStepIsComplete = true;
      } else if (step.key === 'ArgonInstall' && this.installStatusServer.ArgonInstall >= 100) {
        stepIncrease = fastStepIncrease;
        serverStepIsComplete = true;
      } else if (step.key === 'DockerLaunch' && this.installStatusServer.DockerLaunch === 100) {
        stepIncrease = 0.60;
        step.isSlow = false;
        serverStepIsComplete = true;
      } else if (step.key === 'DockerLaunch' && step.progress > this.installStatusServer.DockerLaunch) {
        stepIncrease = step.progress - this.installStatusServer.DockerLaunch;
      } else if (step.key === 'DockerLaunch' && this.installStatusServer.DockerLaunch > step.progress) {
        stepIncrease = Math.max(this.installStatusServer.DockerLaunch - step.progress, 0);
        stepIncrease = Math.min(stepIncrease, fastStepIncrease);
        step.isSlow = stepIncrease < 0.0001 ? true : false;
      }

      step.progress = Math.min(step.progress + stepIncrease, serverStepIsComplete ? 100 : 99.99);
      break;
    }

    if (this.currentStep !== currentStep) {
      this.startTimeOfStep = dayjs();
      this.currentStep = currentStep;
    }

    if (this.currentStep?.key === 'DockerLaunch' && this.currentStep?.progress === 100) {
      this.isProvisioned.value = true;
      this.isRunningProgressCalculations = false;
      if (this.finishedFn) {
        this.finishedFn();
      }
    } else if (this.currentStep?.progress === 100) {
      this.currentStep.status = 'completing';
      setTimeout(() => this.runProgressCalculations(), 1000);
    } else if (!['hidden', 'failed'].includes(this.currentStep?.status ?? '')) {
      setTimeout(() => this.runProgressCalculations(), 10);
    } else {
      this.isRunningProgressCalculations = false;
    }
  }

  private throttleFetchInstallStatus() {
    const now = Date.now();
    const timeSinceLastSave = now - this.lastFetchInstallStatus;
    
    if (timeSinceLastSave < SAVE_THROTTLE_INTERVAL) {
      // If we're throttled, schedule a save for later
      if (!this.hasPendingFetchInstallStatus) {
        this.hasPendingFetchInstallStatus = true;
        const delay = SAVE_THROTTLE_INTERVAL - timeSinceLastSave;
        
        // Clear any existing timeout
        if (this.saveTimeout !== null) {
          clearTimeout(this.saveTimeout);
        }
        
        // Schedule a new save
        this.saveTimeout = window.setTimeout(() => {
          this.hasPendingFetchInstallStatus = false;
          this.lastFetchInstallStatus = Date.now();
          this.fetchInstallStatus();
        }, delay);
      }
      return;
    }
    
    // If we're not throttled, fetch immediately
    this.lastFetchInstallStatus = now;
    this.fetchInstallStatus();
  }
  
  private async fetchInstallStatus() {
    if (!this.isRunning) {
      return;
    }

    const installStatusClient = this.steps.reduce((acc, step) => ({
      ...acc,
      [step.key]: step.progress
    }), {});
    this.installStatusServer = await invoke('fetch_install_status', { installStatusClient });
  }

  public async retryStep(step: IStep) {
    const stepKey = step.key === 'ssh' ? 'all' : step.key;
    await invoke('retry_failed_step', { stepKey });
  
    step.status = 'working';
    step.progress = 0;
    
    for (const s of this.steps) {
      if (s.status === 'hidden') {
        s.status = 'pending';
      }
    }
    
    this.installStatusServer.errorType = '';
    this.installStatusServer.errorMessage = '';
    this.hasError.value = false;
    this.errorType.value = '';
    
    if (!this.isRunningProgressCalculations) {
      this.runProgressCalculations();
    }
  }
}