import * as Vue from 'vue';
import { defineStore } from 'pinia';
import basicEmitter from '../emitters/basicEmitter';
import { useConfig, Config } from './config';
import { useStats } from './stats';
import { useWallets } from './wallets';
import { useCurrency } from './currency';
import { useBot } from './bot';

export const useController = defineStore('controller', () => {
  const panel = Vue.ref('mining');

  function setPanel(value: string) {
    if (panel.value === value) return;

    basicEmitter.emit('closeAllOverlays');
    panel.value = value;
  }

  const config = useConfig();
  const stats = useStats();
  const wallets = useWallets();
  const currency = useCurrency();
  const bot = useBot();

  const totalMiningResources = Vue.computed(() => {
    const miningSeatsValue =
      stats.myMiningSeats.microgonsToBeMined +
      currency.micronotToMicrogon(stats.myMiningSeats.micronotsToBeMined) +
      currency.micronotToMicrogon(stats.myMiningSeats.micronotsMined) +
      (stats.myMiningSeats.microgonsMinted || 0n) +
      (stats.myMiningSeats.microgonsMined || 0n);

    return (
      wallets.miningWallet.availableMicrogons +
      currency.micronotToMicrogon(wallets.miningWallet.availableMicronots) +
      currency.micronotToMicrogon(wallets.miningWallet.reservedMicronots) +
      miningSeatsValue +
      stats.myMiningBids.microgonsBid
    );
  });

  const totalNetWorth = Vue.computed(() => {
    return totalMiningResources.value;
  });

  return {
    panel,
    setPanel,
    totalNetWorth,
    totalMiningResources,
  };
});
