import * as Vue from 'vue';
import { defineStore } from 'pinia';
import { invoke } from "@tauri-apps/api/core";

type StepStatus = 'pending' | 'working' | 'completing' | 'completed' | 'failed';

export interface IStep {
  key: string;
  progress: number;
  status: StepStatus;
  labels: [string, string, string];
  isSlow?: boolean;
}

const steps: IStep[] = Vue.reactive([
  {
    key: 'ssh-connect',
    progress: 0,
    status: 'working',
    labels: [
      `Connect to Server`,
      `Connecting to Server`,
      `Connected to Server`,
    ],
  },
  {
    key: 'ubuntu-check',
    progress: 0,
    status: 'pending',
    labels: [
      `Check Ubuntu 22.04 and Related Libraries`,
      `Checking Ubuntu 22.04 and Related Libraries`,
      `Checked Ubuntu 22.04 and Related Libraries`,
    ],
  },
  {
    key: 'git-clone',
    progress: 0,
    status: 'pending',
    labels: [
      `Clone Argon Deployment Repository`,
      `Cloning Argon Deployment Repository`,
      `Cloned Argon Deployment Repository`,
    ],
  },
  {
    key: 'docker-init',
    progress: 0,
    status: 'pending',
    labels: [
      `Ensure Docker v28.0 and Required Images Are Installed`,
      `Ensuring Docker v28.0 and Required Images Are Installed`,
      `Ensured Docker v28.0 and Required Images Are Installed`,
    ],
  },
  {
    key: 'bitcoin-argon-init',
    progress: 0,
    status: 'pending',
    labels: [
      `Verify Bitcoin v28.1 and Argon Miner v1.0.16`,
      `Verifying Bitcoin v28.1 and Argon Miner v1.0.16`,
      `Verified Bitcoin v28.1 and Argon Miner v1.0.16`,
    ],
  },
  {
    key: 'blockdata-sync',
    progress: 0,
    status: 'pending',
    labels: [
      `Sync Bitcoin & Argon Block States`,
      `Syncing Bitcoin & Argon Block States`,
      `Synced Bitcoin & Argon Block States`,
    ],
  },
  {
    key: 'bitcoin-argon-start',
    progress: 0,
    status: 'pending',
    labels: [
      `Start Bitcoin & Argon Mining Nodes`,
      `Starting Bitcoin & Argon Mining Nodes`,
      `Started Bitcoin & Argon Mining Nodes`,
    ],
  },
]);

export const useServerStore = defineStore('server', () => {
  const isLoading = Vue.ref(true);
  const isSaved = Vue.ref(false);
  const isSetup = Vue.ref(false);

  const address = Vue.ref('');
  const publicKey = Vue.ref('');

  let setupStatus = Vue.reactive({
    ubuntu: 0,
    git: 0,
    docker: 0,
    blocksync: 0,
  });

  async function saveServer(address: string) {
    await invoke('initialize_server', { address });
    isSaved.value = true;
    fetchSetupStatus();
  }

  async function fetchSetupStatus() {
    setupStatus = await invoke('fetch_server_status');
    setTimeout(() => fetchSetupStatus(), 5e3);
  }

  function updateProgress() {
    let currentStep = steps[0];
  
    for (const step of steps) {
      if (step.progress === 100) {
        step.status = 'completed';
        continue;
      }
      
      step.status = 'working';

      let serverStepIsComplete = false;
      let stepIncrease = Math.max(0.02 - (0.08 * step.progress / 100), 0.0005);

      if (step.key === 'ssh-connect' && setupStatus.ubuntu > 0) {
        stepIncrease = 0.40;
        serverStepIsComplete = true;
      } else if (step.key === 'ubuntu-check' && setupStatus.ubuntu > step.progress) {
        stepIncrease = 0.40;
        serverStepIsComplete = true;
      } else if (step.key === 'git-clone' && setupStatus.git > step.progress) {
        stepIncrease = 0.40;
        serverStepIsComplete = true;
      } else if (step.key === 'docker-init' && setupStatus.docker > step.progress) {
        stepIncrease = 0.40;
        serverStepIsComplete = true;
      } else if (step.key === 'bitcoin-argon-init' && setupStatus.blocksync > 0) {
        stepIncrease = 0.40;
        serverStepIsComplete = true;
      } else if (step.key === 'blockdata-sync' && setupStatus.blocksync < step.progress) {
        stepIncrease = Math.max(setupStatus.blocksync - step.progress, 0);
        step.isSlow = stepIncrease < 0.0001 ? true : false;
      } else if (step.key === 'blockdata-sync' && setupStatus.blocksync === 100) {
        stepIncrease = 0.40;
        step.isSlow = false;
        serverStepIsComplete = true;
      } else if (step.key === 'bitcoin-argon-start') {
        stepIncrease = 0.40;
        serverStepIsComplete = step.progress + stepIncrease >= 100;
      }

      step.progress = Math.min(step.progress + stepIncrease, serverStepIsComplete ? 100 : 99.99);
      currentStep = step;
      break;
    }
    if (currentStep.key === 'bitcoin-argon-start' && currentStep.progress === 100) {
      isSetup.value = true;
    } else if (currentStep.progress === 100) {
      currentStep.status = 'completing';
      setTimeout(updateProgress, 1000);
    } else {
      setTimeout(updateProgress, 10);
    }
  }

  invoke('fetch_server').then(async (serverRecord: any) => {
    address.value = serverRecord.address;
    publicKey.value = serverRecord.publicKey;
    isSaved.value = serverRecord.isSaved;
    isSetup.value = serverRecord.isSetup || false;
    setupStatus = serverRecord.setupStatus;

    for (const step of steps) {
      if (
        (step.key === 'ssh-connect' && setupStatus.ubuntu > 0) ||
        (step.key === 'ubuntu-check' && setupStatus.ubuntu === 100) ||
        (step.key === 'git-clone' && setupStatus.git === 100) ||
        (step.key === 'docker-init' && setupStatus.docker === 100) ||
        (step.key === 'bitcoin-argon-init' && setupStatus.blocksync > 0) ||
        (step.key === 'blockdata-sync' && setupStatus.blocksync === 100) ||
        (step.key === 'bitcoin-argon-start' && setupStatus.blocksync === 100)
      ) {
        step.status = 'completed';
        step.progress = 100;
        if (step.key === 'bitcoin-argon-start' && step.progress === 100) {
          isSetup.value = true;
        }
      }
    }

    steps[0].labels[0] = `Connect to ${address.value}`;
    steps[0].labels[1] = `Connecting to ${address.value}`;
    steps[0].labels[2] = `Connected to ${address.value}`;
    updateProgress();
    isLoading.value = false;
    if (!isSetup.value) {
      await fetchSetupStatus();
    }
  });

  return { 
    address,
    publicKey,
    isLoading,
    isSaved, 
    isSetup,
    saveServer,
    steps,
   }
});