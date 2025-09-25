export interface IBlockNumbers {
  localNode: number;
  mainNode: number;
}

export interface ILatestBlocks {
  mainNodeBlockNumber: number;
  localNodeBlockNumber: number;
}

export interface IBitcoinLatestBlocks extends ILatestBlocks {
  localNodeBlockTime: number;
}
