import * as Vue from 'vue';
import { defineStore } from 'pinia';
import emitter from '../emitters/basic';
import { useConfig } from './config';
import { useStats } from './stats';
import { useWallets } from './wallets';
import { useCurrency } from './currency';

export const useController = defineStore('controller', () => {
  const panel = Vue.ref('mining');

  function setPanel(value: string) {
    if (panel.value === value) return;

    emitter.emit('closeAllOverlays');
    panel.value = value;
  }

  const config = useConfig();
  const stats = useStats();
  const wallets = useWallets();
  const currency = useCurrency();

  const totalMiningResources = Vue.computed(() => {
    const miningSeatsValue =
      stats.miningSeats.microgonsToBeMined +
      currency.micronotToMicrogon(stats.miningSeats.micronotsToBeMined) +
      currency.micronotToMicrogon(stats.miningSeats.micronotsMined) +
      (stats.miningSeats.microgonsMinted || 0n) +
      (stats.miningSeats.microgonsMined || 0n);

    return (
      wallets.mngWallet.availableMicrogons +
      currency.micronotToMicrogon(wallets.mngWallet.availableMicronots) +
      currency.micronotToMicrogon(wallets.mngWallet.reservedMicronots) +
      miningSeatsValue +
      stats.myMiningBidCost
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
