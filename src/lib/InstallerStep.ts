
type StepStatus = 'pending' | 'working' | 'completing' | 'completed' | 'failed' | 'hidden';

export interface IStep {
  key: string;
  progress: number;
  status: StepStatus;
  labels: [string, string, string];
  isSlow?: boolean;
}

export const defaultSteps: IStep[] = [
  {
    key: 'ServerConnect',
    progress: 0,
    status: 'working',
    labels: [
      `Connect to Server`,
      `Connecting to Server`,
      `Connected to Server`,
    ],
  },
  {
    key: 'UbuntuCheck',
    progress: 0,
    status: 'pending',
    labels: [
      `Check Ubuntu 24.10 and Related Libraries`,
      `Checking Ubuntu 24.10 and Related Libraries`,
      `Checked Ubuntu 24.10 and Related Libraries`,
    ],
  },
  {
    key: 'FileCheck',
    progress: 0,
    status: 'pending',
    labels: [
      `Install Core Server Files`,
      `Installing Core Server Files`,
      `Installed Core Server Files`,
    ],
  },
  {
    key: 'DockerInstall',
    progress: 0,
    status: 'pending',
    labels: [
      `Verify Docker v28.0 and Install Required Images`,
      `Verifying Docker v28.0 and Installing Required Images`,
      `Verified Docker v28.0 and Installed Required Images`,
    ],
  },
  {
    key: 'BitcoinInstall',
    progress: 0,
    status: 'pending',
    labels: [
      `Install Bitcoin v28.1 and Sync Bitcoin Block Data`,
      `Installing Bitcoin v28.1 and Syncing Bitcoin Block Data`,
      `Installed Bitcoin v28.1 and Synced Bitcoin Block Data`,
    ],
  },
  {
    key: 'ArgonInstall',
    progress: 0,
    status: 'pending',
    labels: [
      `Install Argon Miner v1.1.0 and Sync Argon Block Data`,
      `Installing Argon Miner v1.1.0 and Syncing Argon Block Data`,
      `Installed Argon Miner v1.1.0 and Synced Argon Block Data`,
    ],
  },
  {
    key: 'DockerLaunch',
    progress: 0,
    status: 'pending',
    labels: [
      `Launch Bitcoin & Argon Mining Nodes`,
      `Launching Bitcoin & Argon Mining Nodes`,
      `Launched Bitcoin & Argon Mining Nodes`,
    ],
  },
];