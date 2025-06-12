import { InstallStepKey, InstallStepStatus } from '../interfaces/IConfig';

type IStepLabel = [string, string, string];

export interface IStep {
  key: InstallStepKey;
  progress: number;
  status: InstallStepStatus;
  templates?: IStepLabel;
  labels: IStepLabel;
  isSlow?: boolean;
}

const serverConnectTemplates: IStepLabel = [
  `Connect to {IP_ADDRESS}`,
  `Connecting to {IP_ADDRESS}`,
  `Connected to {IP_ADDRESS}`,
];

export const stepMetas: IStep[] = [
  {
    key: InstallStepKey.ServerConnect,
    progress: 0,
    status: InstallStepStatus.Working,
    templates: serverConnectTemplates,
    labels: serverConnectTemplates.map(x => x.replace('{IP_ADDRESS}', 'Server')) as IStepLabel,
  },
  {
    key: InstallStepKey.FileCheck,
    progress: 0,
    status: InstallStepStatus.Pending,
    labels: [
      `Upload Core Server Files`,
      `Uploading Core Server Files`,
      `Uploaded Core Server Files`,
    ] as IStepLabel,
  },
  {
    key: InstallStepKey.UbuntuCheck,
    progress: 0,
    status: InstallStepStatus.Pending,
    labels: [
      `Check Ubuntu 24.10 and Related Libraries`,
      `Checking Ubuntu 24.10 and Related Libraries`,
      `Checked Ubuntu 24.10 and Related Libraries`,
    ],
  },
  {
    key: InstallStepKey.DockerInstall,
    progress: 0,
    status: InstallStepStatus.Pending,
    labels: [
      `Verify Docker v28.0 and Install Required Images`,
      `Verifying Docker v28.0 and Installing Required Images`,
      `Verified Docker v28.0 and Installed Required Images`,
    ],
  },
  {
    key: InstallStepKey.BitcoinInstall,
    progress: 0,
    status: InstallStepStatus.Pending,
    labels: [
      `Install Bitcoin v28.1 and Sync Bitcoin Block Data`,
      `Installing Bitcoin v28.1 and Syncing Bitcoin Block Data`,
      `Installed Bitcoin v28.1 and Synced Bitcoin Block Data`,
    ],
  },
  {
    key: InstallStepKey.ArgonInstall,
    progress: 0,
    status: InstallStepStatus.Pending,
    labels: [
      `Install Argon v1.1.0 and Sync Argon Block Data`,
      `Installing Argon v1.1.0 and Syncing Argon Block Data`,
      `Installed Argon v1.1.0 and Synced Argon Block Data`,
    ],
  },
  {
    key: InstallStepKey.MiningLaunch,
    progress: 0,
    status: InstallStepStatus.Pending,
    labels: [
      `Launch Bitcoin & Argon Mining Nodes`,
      `Launching Bitcoin & Argon Mining Nodes`,
      `Launched Bitcoin & Argon Mining Nodes`,
    ],
  },
];
