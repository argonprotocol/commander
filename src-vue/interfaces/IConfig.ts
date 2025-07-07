import { z } from 'zod';
import { BiddingRulesSchema, IBiddingRules } from '@argonprotocol/commander-calculator/src/IBiddingRules';

export enum InstallStepKey {
  ServerConnect = 'ServerConnect',
  FileUpload = 'FileUpload',
  UbuntuCheck = 'UbuntuCheck',
  DockerInstall = 'DockerInstall',
  BitcoinInstall = 'BitcoinInstall',
  ArgonInstall = 'ArgonInstall',
  MiningLaunch = 'MiningLaunch',
}

export enum InstallStepErrorType {
  Unknown = 'Unknown',
  FileUpload = InstallStepKey.FileUpload,
  UbuntuCheck = InstallStepKey.UbuntuCheck,
  DockerInstall = InstallStepKey.DockerInstall,
  BitcoinInstall = InstallStepKey.BitcoinInstall,
  ArgonInstall = InstallStepKey.ArgonInstall,
  MiningLaunch = InstallStepKey.MiningLaunch,
}

export enum InstallStepStatus {
  Pending = 'Pending',
  Working = 'Working',
  Completing = 'Completing',
  Completed = 'Completed',
  Failed = 'Failed',
  Hidden = 'Hidden',
}

export const ConfigSecuritySchema = z.object({
  walletMnemonic: z.string(),
  sessionMnemonic: z.string(),
  walletJson: z.string(),
});

export const ConfigServerDetailsSchema = z.object({
  ipAddress: z.string(),
  sshPublicKey: z.string(),
  sshPrivateKey: z.string(),
  sshUser: z.string(),
});

export const ConfigInstallStep = z.object({
  progress: z.number(),
  status: z.nativeEnum(InstallStepStatus),
  startDate: z.string().nullable(),
});

export const ConfigInstallDetailsSchema = z.object({
  [InstallStepKey.ServerConnect]: ConfigInstallStep,
  [InstallStepKey.FileUpload]: ConfigInstallStep,
  [InstallStepKey.UbuntuCheck]: ConfigInstallStep,
  [InstallStepKey.DockerInstall]: ConfigInstallStep,
  [InstallStepKey.BitcoinInstall]: ConfigInstallStep,
  [InstallStepKey.ArgonInstall]: ConfigInstallStep,
  [InstallStepKey.MiningLaunch]: ConfigInstallStep,
  errorType: z.nativeEnum(InstallStepErrorType).nullable(),
  errorMessage: z.string().nullable(),
  isRunning: z.boolean(),
});

export const ConfigSyncDetailsSchema = z.object({
  progress: z.number(),
  startDate: z.string().nullable(),
  startPosition: z.number().nullable(),
  errorType: z.string().nullable(),
  errorMessage: z.string().nullable(),
});

// ---- Main Schema ---- //

export const ConfigSchema = z.object({
  version: z.string(),
  requiresPassword: z.boolean(),
  security: ConfigSecuritySchema,
  serverDetails: ConfigServerDetailsSchema,
  installDetails: ConfigInstallDetailsSchema,
  oldestFrameIdToSync: z.number().nullable(),

  isServerConnected: z.boolean(), // isConnected
  isServerInstalled: z.boolean(), // isNewServer
  isServerUpToDate: z.boolean(), // isInstalling
  isServerReadyForBidding: z.boolean(), // isReadyForMining
  isWaitingForUpgradeApproval: z.boolean(), // isRequiringUpgrade

  hasMiningSeats: z.boolean(), // hasMiningSeats
  hasMiningBids: z.boolean(), // hasMiningBids
  biddingRules: BiddingRulesSchema.nullable(),
});

// ---- Optional Type Inference ---- //

export type IConfigSecurity = z.infer<typeof ConfigSecuritySchema>;
export type IConfigServerDetails = z.infer<typeof ConfigServerDetailsSchema>;
export type IConfigInstallDetails = z.infer<typeof ConfigInstallDetailsSchema>;
export type IConfigInstallStep = z.infer<typeof ConfigInstallStep>;
export type IConfigSyncDetails = z.infer<typeof ConfigSyncDetailsSchema>;
export type IConfig = z.infer<typeof ConfigSchema>;

export type IConfigStringified = {
  [K in keyof IConfig]: string;
};

export interface IConfigDefaults {
  requiresPassword: () => IConfig['requiresPassword'];
  security: () => IConfig['security'];
  serverDetails: () => Promise<IConfig['serverDetails']>;
  installDetails: () => IConfig['installDetails'];
  oldestFrameIdToSync: () => IConfig['oldestFrameIdToSync'];
  isServerConnected: () => IConfig['isServerConnected'];
  isServerInstalled: () => IConfig['isServerInstalled'];
  isServerUpToDate: () => IConfig['isServerUpToDate'];
  isServerReadyForBidding: () => IConfig['isServerReadyForBidding'];
  isWaitingForUpgradeApproval: () => IConfig['isWaitingForUpgradeApproval'];
  hasMiningSeats: () => IConfig['hasMiningSeats'];
  hasMiningBids: () => IConfig['hasMiningBids'];
  biddingRules: () => IConfig['biddingRules'];
}
