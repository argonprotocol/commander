import type { IConfig } from './IConfig.ts';

export interface IConfigQueryRef
  extends Pick<
    IConfig,
    | 'miningSetupStatus'
    | 'vaultingSetupStatus'
    | 'biddingRules'
    | 'vaultingRules'
    | 'serverAdd'
    | 'upstreamOperator'
    | 'hasExtensionOperations'
  > {
  showWelcomeOverlay: boolean;
  hasSavedBiddingRules: boolean;
  hasSavedVaultingRules: boolean;
  isServerAdded: boolean;
  isBootingUpPreviousWalletHistory: boolean;
  save(): Promise<void>;
}
