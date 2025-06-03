import * as Vue from 'vue';
import { defineStore } from 'pinia';
import BitcoinPrices from '../lib/BitcoinPrices';
import BitcoinFees from '../lib/BitcoinFees';

export const useBitcoinStore = defineStore('bitcoin', () => {
  const bitcoinPrices = new BitcoinPrices();
  const bitcoinFees = new BitcoinFees();

  return { 
    bitcoinPrices,
    bitcoinFees,
   }
});