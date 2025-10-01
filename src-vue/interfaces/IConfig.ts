import { z } from 'zod';
import { BiddingRulesSchema } from '@argonprotocol/commander-core';
import { VaultingRulesSchema } from './IVaultingRules';
import { CurrencyKey } from '../lib/Currency';

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

export enum PanelKey {
  Mining = 'Mining',
  Vaulting = 'Vaulting',
}

export enum ServerType {
  DigitalOcean = 'DigitalOcean',
  AnyServer = 'AnyServer',
  Docker = 'Docker',
}

export const ConfigServerDetailsSchema = z.object({
  ipAddress: z.string().ip(),
  port: z.number().optional(),
  sshUser: z.string(),
  type: z.nativeEnum(ServerType),
  workDir: z.string(),
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

export const MiningAccountPreviousHistoryBidSchema = z.object({
  bidPosition: z.number(),
  microgonsBid: z.bigint(),
  micronotsStaked: z.bigint(),
});

export const MiningAccountPreviousHistorySeatSchema = z.object({
  seatPosition: z.number(),
  microgonsBid: z.bigint(),
  micronotsStaked: z.bigint(),
});

export const MiningAccountPreviousHistoryRecordSchema = z.object({
  frameId: z.number(),
  bids: z.array(MiningAccountPreviousHistoryBidSchema),
  seats: z.array(MiningAccountPreviousHistorySeatSchema),
});

// ---- Main Schema ---- //

export const ConfigSchema = z.object({
  panelKey: z.nativeEnum(PanelKey),
  version: z.string(),
  requiresPassword: z.boolean(),
  showWelcomeOverlay: z.boolean(),

  serverDetails: ConfigServerDetailsSchema,
  installDetails: ConfigInstallDetailsSchema,
  oldestFrameIdToSync: z.number(),
  latestFrameIdProcessed: z.number(),

  miningAccountAddress: z.string(),
  miningAccountHadPreviousLife: z.boolean(),
  miningAccountPreviousHistory: z.array(MiningAccountPreviousHistoryRecordSchema).nullable(),

  hasReadMiningInstructions: z.boolean(),
  isPreparingMinerSetup: z.boolean(),
  isMinerReadyToInstall: z.boolean(), // isConnected
  isMinerInstalled: z.boolean(), // isNewServer
  isMinerUpToDate: z.boolean(), // isInstalling
  isMinerWaitingForUpgradeApproval: z.boolean(), // isRequiringUpgrade

  hasReadVaultingInstructions: z.boolean(),
  isPreparingVaultSetup: z.boolean(),
  isVaultReadyToCreate: z.boolean(),

  hasMiningSeats: z.boolean(), // hasMiningSeats
  hasMiningBids: z.boolean(), // hasMiningBids
  biddingRules: BiddingRulesSchema,
  vaultingRules: VaultingRulesSchema,

  defaultCurrencyKey: z.nativeEnum(CurrencyKey),
  userJurisdiction: z.object({
    ipAddress: z.string(),
    city: z.string(),
    region: z.string(),
    countryName: z.string(),
    countryCode: z.string(),
    latitude: z.string(),
    longitude: z.string(),
  }),
});

// ---- Optional Type Inference ---- //

export type IMiningAccountPreviousHistoryBid = z.infer<typeof MiningAccountPreviousHistoryBidSchema>;
export type IMiningAccountPreviousHistorySeat = z.infer<typeof MiningAccountPreviousHistorySeatSchema>;
export type IMiningAccountPreviousHistoryRecord = z.infer<typeof MiningAccountPreviousHistoryRecordSchema>;

export type IConfigServerDetails = z.infer<typeof ConfigServerDetailsSchema>;
export type IConfigInstallDetails = z.infer<typeof ConfigInstallDetailsSchema>;
export type IConfigInstallStep = z.infer<typeof ConfigInstallStep>;
export type IConfigSyncDetails = z.infer<typeof ConfigSyncDetailsSchema>;
export type IConfig = z.infer<typeof ConfigSchema>;

export type IConfigStringified = {
  [K in keyof IConfig]: string;
};

export interface IConfigDefaults {
  panelKey: () => IConfig['panelKey'];
  requiresPassword: () => IConfig['requiresPassword'];
  showWelcomeOverlay: () => IConfig['showWelcomeOverlay'];

  serverDetails: () => IConfig['serverDetails'];
  installDetails: () => IConfig['installDetails'];
  oldestFrameIdToSync: () => IConfig['oldestFrameIdToSync'];
  latestFrameIdProcessed: () => IConfig['latestFrameIdProcessed'];
  miningAccountAddress: () => IConfig['miningAccountAddress'];
  miningAccountHadPreviousLife: () => IConfig['miningAccountHadPreviousLife'];
  miningAccountPreviousHistory: () => IConfig['miningAccountPreviousHistory'];

  hasReadMiningInstructions: () => IConfig['hasReadMiningInstructions'];
  isPreparingMinerSetup: () => IConfig['isPreparingMinerSetup'];
  isMinerReadyToInstall: () => IConfig['isMinerReadyToInstall'];
  isMinerInstalled: () => IConfig['isMinerInstalled'];
  isMinerUpToDate: () => IConfig['isMinerUpToDate'];
  isMinerWaitingForUpgradeApproval: () => IConfig['isMinerWaitingForUpgradeApproval'];

  hasReadVaultingInstructions: () => IConfig['hasReadVaultingInstructions'];
  isPreparingVaultSetup: () => IConfig['isPreparingVaultSetup'];
  isVaultReadyToCreate: () => IConfig['isVaultReadyToCreate'];

  hasMiningSeats: () => IConfig['hasMiningSeats'];
  hasMiningBids: () => IConfig['hasMiningBids'];
  biddingRules: () => IConfig['biddingRules'];
  vaultingRules: () => IConfig['vaultingRules'];
  defaultCurrencyKey: () => IConfig['defaultCurrencyKey'];
  userJurisdiction: () => Promise<IConfig['userJurisdiction']>;
}
