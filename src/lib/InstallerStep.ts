
type StepStatus = 'pending' | 'working' | 'completing' | 'completed' | 'failed' | 'hidden';

type IStepLabel = [string, string, string];

export interface IStep {
  key: string;
  progress: number;
  status: StepStatus;
  templates?: IStepLabel;
  labels: IStepLabel;
  isSlow?: boolean;
}

const serverConnectTemplates: IStepLabel = [
  `Connect to {IP_ADDRESS}`,
  `Connecting to {IP_ADDRESS}`,
  `Connected to {IP_ADDRESS}`,
];

const fileCheckTemplates: IStepLabel = [
  `{VERB} Core Server Files`,
  `{VERB} Core Server Files`,
  `{VERB} Core Server Files`,
];

export const defaultSteps: IStep[] = [
  {
    key: 'ServerConnect',
    progress: 0,
    status: 'working',
    templates: serverConnectTemplates,
    labels: serverConnectTemplates.map(x => x.replace('{IP_ADDRESS}', 'Server')) as IStepLabel,
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
    templates: fileCheckTemplates,
    labels: [
      fileCheckTemplates[0].replace('{VERB}', 'Install'),
      fileCheckTemplates[1].replace('{VERB}', 'Installing'),
      fileCheckTemplates[2].replace('{VERB}', 'Installed'),
    ] as IStepLabel,
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
      `Install Argon v1.1.0 and Sync Argon Block Data`,
      `Installing Argon v1.1.0 and Syncing Argon Block Data`,
      `Installed Argon v1.1.0 and Synced Argon Block Data`,
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