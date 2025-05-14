import * as Vue from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import dayjs, { type Dayjs } from 'dayjs';
type StepStatus = 'pending' | 'working' | 'completing' | 'completed' | 'failed' | 'hidden';

export interface IServerStatus {
  ssh: number;
  ubuntu: number;
  system: number;
  docker: number;
  bitcoinsync: number;
  argonsync: number;
  minerlaunch: number;
  errorType: 'ssh' | 'ubuntu' | 'system' | 'docker' | 'bitcoinsync' | 'argonsync' | 'minerlaunch' | 'unknown' | '';
  errorMessage: string;
}

export interface IStep {
  key: string;
  progress: number;
  status: StepStatus;
  labels: [string, string, string];
  isSlow?: boolean;
}

////////////////////////////////////////////////////////////
export default class Provisioner {

  public isProvisioned = Vue.ref(false);
  public hasError = Vue.ref(false);
  public errorType = Vue.ref('');
  
  public finishedFn: (() => void) | null = null;

  private isRunning = false;
  private isRunningProgressCalculations = false;

  private startTimeOfStep: Dayjs | null = null;
  private currentStep: IStep | null = null;
  private lastSaveTime: number = 0;
  private saveThrottleInterval: number = 5000; // 5 seconds in milliseconds
  private pendingSave: boolean = false;
  private saveTimeout: number | null = null;

  private _serverStatus: IServerStatus | null = null;

  public steps: IStep[] = Vue.reactive([
    {
      key: 'ssh',
      progress: 0,
      status: 'working',
      labels: [
        `Connect to Server`,
        `Connecting to Server`,
        `Connected to Server`,
      ],
    },
    {
      key: 'ubuntu',
      progress: 0,
      status: 'pending',
      labels: [
        `Check Ubuntu 24.10 and Related Libraries`,
        `Checking Ubuntu 24.10 and Related Libraries`,
        `Checked Ubuntu 24.10 and Related Libraries`,
      ],
    },
    {
      key: 'system',
      progress: 0,
      status: 'pending',
      labels: [
        `Install Argon Network Configuration`,
        `Copying Argon Network Configuration`,
        `Installed Argon Network Configuration`,
      ],
    },
    {
      key: 'docker',
      progress: 0,
      status: 'pending',
      labels: [
        `Verify Docker v28.0 and Install Required Images`,
        `Verifying Docker v28.0 and Installing Required Images`,
        `Verified Docker v28.0 and Installed Required Images`,
      ],
    },
    {
      key: 'bitcoinsync',
      progress: 0,
      status: 'pending',
      labels: [
        `Install Bitcoin v28.1 and Sync Bitcoin Block Data`,
        `Installing Bitcoin v28.1 and Syncing Bitcoin Block Data`,
        `Installed Bitcoin v28.1 and Synced Bitcoin Block Data`,
      ],
    },
    {
      key: 'argonsync',
      progress: 0,
      status: 'pending',
      labels: [
        `Install Argon Miner v1.1.0 and Sync Argon Block Data`,
        `Installing Argon Miner v1.1.0 and Syncing Argon Block Data`,
        `Installed Argon Miner v1.1.0 and Synced Argon Block Data`,
      ],
    },
    {
      key: 'minerlaunch',
      progress: 0,
      status: 'pending',
      labels: [
        `Launch Bitcoin & Argon Mining Nodes`,
        `Launching Bitcoin & Argon Mining Nodes`,
        `Launched Bitcoin & Argon Mining Nodes`,
      ],
    },
  ]);

  constructor() {
    listen('ServerStatus', (event: any) => {
      this.updateServerStatus(event.payload, true);
      if (this.isRunning && !this.isRunningProgressCalculations) {
        this.runProgressCalculations();
      }
    });
  }

  private get serverStatus(): IServerStatus {
    return this._serverStatus || {
      ssh: 0,
      ubuntu: 0,
      system: 0,
      docker: 0,
      bitcoinsync: 0,
      argonsync: 0,
      minerlaunch: 0,
      errorType: '',
      errorMessage: '',
    };
  }

  public updateServerStatus(serverStatus: any, overrideExisting = false) {   
    console.log('updateServerStatus', serverStatus);
    if (this._serverStatus && !overrideExisting) return
    this._serverStatus = serverStatus;
  }

  public setIpAddress(ipAddress: string) {
    this.steps[0].labels[0] = `Connect to ${ipAddress}`;
    this.steps[0].labels[1] = `Connecting to ${ipAddress}`;
    this.steps[0].labels[2] = `Connected to ${ipAddress}`;
  }

  public async run(serverProgress: any = {}) {
    for (const [index, step] of Object.entries(this.steps)) {
      const lastIndex = Number(index) - 1;
      const lastStep = lastIndex >= 0 ? this.steps[lastIndex] : {} as any;

      if (serverProgress[step.key]) {
        step.progress = serverProgress[step.key];
      }

      if (['failed', 'hidden'].includes(lastStep.status)) {
        step.status = 'hidden';
      } else if (
        (step.key === 'ssh' && this.serverStatus.ubuntu > 0) ||
        (step.key === 'ubuntu' && this.serverStatus.ubuntu === 100) ||
        (step.key === 'system' && this.serverStatus.system === 100) ||
        (step.key === 'docker' && this.serverStatus.docker === 100) ||
        (step.key === 'bitcoinsync' && this.serverStatus.bitcoinsync == 100) ||
        (step.key === 'argonsync' && this.serverStatus.argonsync === 100) ||
        (step.key === 'minerlaunch' && this.serverStatus.minerlaunch === 100)
      ) {
        step.status = 'completed';
        step.progress = 100;
        if (step.key === 'minerlaunch') {
          this.isProvisioned.value = true;
        }
      } else if (this.serverStatus.errorType) {
        step.status = 'failed';
        this.hasError.value = true;
        this.errorType.value = this.serverStatus.errorType;
      }
    }

    this.isRunning = true;
    if (!this.isProvisioned.value) {
      await this.runProgressCalculations();
    }
  }

  private async runProgressCalculations() {  
    this.isRunningProgressCalculations = true;

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
      
      if (this.serverStatus.errorType === step.key && secondsSinceStepStarted > 10) {
        step.status = 'failed';
        this.hasError.value = true;
        this.errorType.value = this.serverStatus.errorType;
        continue;
      }

      step.status = 'working';

      let serverStepIsComplete = false;
      let stepIncrease = Math.max(0.02 - (0.08 * step.progress / 100), 0.0005);

      if (step.key === 'ssh' && this.serverStatus.ubuntu > 0) {
        stepIncrease = fastStepIncrease * 2;
        serverStepIsComplete = true;
      } else if (step.key === 'ubuntu' && this.serverStatus.ubuntu >= 100) {
        stepIncrease = fastStepIncrease;
        serverStepIsComplete = true;
      } else if (step.key === 'system' && this.serverStatus.system >= 100) {
        stepIncrease = fastStepIncrease;
        serverStepIsComplete = true;
      } else if (step.key === 'docker' && this.serverStatus.docker >= 100) {
        stepIncrease = fastStepIncrease;
        serverStepIsComplete = true;
      } else if (step.key === 'bitcoinsync' && this.serverStatus.bitcoinsync >= 100) {
        stepIncrease = fastStepIncrease;
        serverStepIsComplete = true;
      } else if (step.key === 'argonsync' && this.serverStatus.argonsync >= 100) {
        stepIncrease = fastStepIncrease;
        serverStepIsComplete = true;
      } else if (step.key === 'minerlaunch' && this.serverStatus.minerlaunch === 100) {
        console.log('MINERLAUNCH COMPLETE', this.serverStatus.minerlaunch, step.progress);
        stepIncrease = 0.60;
        step.isSlow = false;
        serverStepIsComplete = true;
      } else if (step.key === 'minerlaunch' && this.serverStatus.minerlaunch > step.progress) {
        stepIncrease = Math.max(this.serverStatus.minerlaunch - step.progress, 0);
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

    await this.throttleSaveServerProgress();
    if (this.currentStep?.key === 'minerlaunch' && this.currentStep?.progress === 100) {
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

  private async throttleSaveServerProgress() {
    const now = Date.now();
    const timeSinceLastSave = now - this.lastSaveTime;
    
    if (timeSinceLastSave < this.saveThrottleInterval) {
      // If we're throttled, schedule a save for later
      if (!this.pendingSave) {
        this.pendingSave = true;
        const delay = this.saveThrottleInterval - timeSinceLastSave;
        
        // Clear any existing timeout
        if (this.saveTimeout !== null) {
          clearTimeout(this.saveTimeout);
        }
        
        // Schedule a new save
        this.saveTimeout = window.setTimeout(() => {
          this.pendingSave = false;
          this.lastSaveTime = Date.now();
          this.saveServerProgress();
        }, delay);
      }
      return;
    }
    
    // If we're not throttled, save immediately
    this.lastSaveTime = now;
    await this.saveServerProgress();
  }
  
  private async saveServerProgress() {
    const progress = this.steps.reduce((acc, step) => ({
      ...acc,
      [step.key]: step.progress
    }), {});
    await invoke('save_server_progress', { progress });
  }

  public resetStep(step: IStep) {
    step.status = 'working';
    step.progress = 0;
    for (const s of this.steps) {
      if (s.status === 'hidden') {
        s.status = 'pending';
      }
    }
    this.updateServerStatus({
      ...this.serverStatus,
      errorType: '',
      errorMessage: '',
    }, true);
    this.hasError.value = false;
    this.errorType.value = '';
    if (!this.isRunningProgressCalculations) {
      this.runProgressCalculations();
    }
  }
}