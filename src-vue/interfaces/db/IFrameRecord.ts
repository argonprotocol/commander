import BigNumber from 'bignumber.js';

export interface IFrameRecord {
  id: number;
  progress: number;
  firstTick: number;
  lastTick: number;
  usdExchangeRates: BigNumber[];
  btcExchangeRates: BigNumber[];
  argnotExchangeRates: BigNumber[];
  isProcessed: boolean;
  createdAt: string;
  updatedAt: string;
}
