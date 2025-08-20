import { z } from 'zod';
import { BiddingRulesSchema } from '@argonprotocol/commander-core/src/IBiddingRules.ts';
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

export const ConfigServerDetailsSchema = z.object({
  ipAddress: z.string(),
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
  version: z.string(),
  requiresPassword: z.boolean(),
  serverDetails: ConfigServerDetailsSchema,
  installDetails: ConfigInstallDetailsSchema,
  oldestFrameIdToSync: z.number(),
  latestFrameIdProcessed: z.number(),

  miningAccountAddress: z.string(),
  miningAccountHadPreviousLife: z.boolean(),
  miningAccountPreviousHistory: z.array(MiningAccountPreviousHistoryRecordSchema).nullable(),

  isVaultReadyToCreate: z.boolean(),

  isServerReadyToInstall: z.boolean(), // isConnected
  isServerInstalled: z.boolean(), // isNewServer
  isServerUpToDate: z.boolean(), // isInstalling
  isWaitingForUpgradeApproval: z.boolean(), // isRequiringUpgrade

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
  requiresPassword: () => IConfig['requiresPassword'];
  serverDetails: () => IConfig['serverDetails'];
  installDetails: () => IConfig['installDetails'];
  oldestFrameIdToSync: () => IConfig['oldestFrameIdToSync'];
  latestFrameIdProcessed: () => IConfig['latestFrameIdProcessed'];
  miningAccountAddress: () => IConfig['miningAccountAddress'];
  miningAccountHadPreviousLife: () => IConfig['miningAccountHadPreviousLife'];
  miningAccountPreviousHistory: () => IConfig['miningAccountPreviousHistory'];
  isVaultReadyToCreate: () => IConfig['isVaultReadyToCreate'];
  isServerReadyToInstall: () => IConfig['isServerReadyToInstall'];
  isServerInstalled: () => IConfig['isServerInstalled'];
  isServerUpToDate: () => IConfig['isServerUpToDate'];
  isWaitingForUpgradeApproval: () => IConfig['isWaitingForUpgradeApproval'];
  hasMiningSeats: () => IConfig['hasMiningSeats'];
  hasMiningBids: () => IConfig['hasMiningBids'];
  biddingRules: () => IConfig['biddingRules'];
  vaultingRules: () => IConfig['vaultingRules'];
  defaultCurrencyKey: () => IConfig['defaultCurrencyKey'];
  userJurisdiction: () => Promise<IConfig['userJurisdiction']>;
}
