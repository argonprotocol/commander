export interface IAllVaultStats {
  synchedToFrame: number;
  vaultsById: {
    [vaultId: number]: IVaultStats;
  };
}

export interface IVaultStats {
  openedTick: number;
  baseline: {
    feeRevenue: bigint;
    satoshis: bigint;
    bitcoinLocks: number;
    microgonLiquidityRealized: bigint;
  };
  changesByFrame: IVaultFrameStats[];
}

export interface IVaultFrameStats {
  frameId: number;
  isFrameInProgress: boolean;
  feeRevenue: bigint;
  satoshisAdded: bigint;
  bitcoinLocksCreated: number;
  microgonLiquidityAdded: bigint;
  securitization: bigint;
  securitizationActivated: bigint;
  liquidityPool: {
    sharingPercent: number;
    contributedCapital: bigint;
    contributedCapitalByVaultOperator: bigint;
    contributorProfit: bigint;
    vaultProfit: bigint;
  };
}
