import * as Vue from 'vue';
import { defineStore } from 'pinia';
import { ask as askDialog } from '@tauri-apps/plugin-dialog';
import { getMainchain } from './mainchain.ts';
import handleUnknownFatalError from './helpers/handleUnknownFatalError.ts';
import { useConfig } from './config.ts';
import { createDeferred } from '../lib/Utils.ts';
import { useStats } from './stats.ts';
import { useCurrency } from './currency.ts';
import { botEmitter } from '../lib/Bot.ts';
import { BotStatus } from '../lib/BotSyncer.ts';
import { IWallet as IWalletBasic, WalletBalances } from '../lib/WalletBalances.ts';
import { MiningFrames } from '@argonprotocol/commander-core';
import BigNumber from 'bignumber.js';

const config = useConfig();

export interface IWallet extends IWalletBasic {
  name: string;
}

export const useWallets = defineStore('wallets', () => {
  const stats = useStats();
  const currency = useCurrency();

  const isLoaded = Vue.ref(false);
  const { promise: isLoadedPromise, resolve: isLoadedResolve, reject: isLoadedReject } = createDeferred<void>();

  const miningWallet = Vue.reactive<IWallet>({
    name: 'Mining Wallet',
    address: '',
    availableMicrogons: 0n,
    availableMicronots: 0n,
    reservedMicronots: 0n,
  });

  const vaultingWallet = Vue.reactive<IWallet>({
    name: 'Vaulting Wallet',
    address: '',
    availableMicrogons: 0n,
    availableMicronots: 0n,
    reservedMicronots: 0n,
  });

  const miningSeatValue = Vue.computed(() => {
    let previousHistoryValue = 0n;

    for (const item of config.miningAccountPreviousHistory || []) {
      previousHistoryValue += item.seats.reduce((acc, seat) => {
        const { microgonsBid } = seat;
        const remainingPercent = new BigNumber(1).minus(MiningFrames.calculateCohortProgress(item.frameId));
        const remainingValue = Math.floor(remainingPercent.times(microgonsBid.toString()).toNumber());
        return acc + BigInt(remainingValue);
      }, 0n);
    }
    return stats.myMiningSeats.microgonValueRemaining + previousHistoryValue;
  });

  const miningBidValue = Vue.computed(() => {
    let previousHistoryValue = 0n;
    for (const item of config.miningAccountPreviousHistory || []) {
      previousHistoryValue += item.bids.reduce((acc, bid) => acc + bid.microgonsBid, 0n);
    }
    return stats.myMiningBids.microgonsBidTotal + previousHistoryValue;
  });

  const totalMiningMicrogons = Vue.computed(() => {
    return miningWallet.availableMicrogons + miningSeatValue.value + miningBidValue.value;
  });

  const totalMiningResources = Vue.computed(() => {
    return (
      miningWallet.availableMicrogons +
      currency.micronotToMicrogon(miningWallet.availableMicronots) +
      currency.micronotToMicrogon(miningWallet.reservedMicronots) +
      miningSeatValue.value +
      miningBidValue.value
    );
  });

  const totalVaultingResources = Vue.computed(() => {
    return (
      vaultingWallet.availableMicrogons +
      currency.micronotToMicrogon(vaultingWallet.availableMicronots) +
      currency.micronotToMicrogon(vaultingWallet.reservedMicronots)
    );
  });

  const totalNetWorth = Vue.computed(() => {
    return totalMiningResources.value + totalVaultingResources.value;
  });

  const totalWalletMicrogons = Vue.ref(0n);
  const totalWalletMicronots = Vue.ref(0n);

  //////////////////////////////////////////////////////////////////////////////

  const walletBalances = new WalletBalances(getMainchain());
  walletBalances.onBalanceChange = () => {
    totalWalletMicrogons.value = walletBalances.totalWalletMicrogons;
    totalWalletMicronots.value = walletBalances.totalWalletMicronots;

    miningWallet.address = walletBalances.miningWallet.address;
    miningWallet.availableMicrogons = walletBalances.miningWallet.availableMicrogons;
    miningWallet.availableMicronots = walletBalances.miningWallet.availableMicronots;
    miningWallet.reservedMicronots = walletBalances.miningWallet.reservedMicronots;

    vaultingWallet.address = walletBalances.vaultingWallet.address;
    vaultingWallet.availableMicrogons = walletBalances.vaultingWallet.availableMicrogons;
    vaultingWallet.availableMicronots = walletBalances.vaultingWallet.availableMicronots;
    vaultingWallet.reservedMicronots = walletBalances.vaultingWallet.reservedMicronots;
  };

  async function load() {
    while (!isLoaded.value) {
      try {
        await config.isLoadedPromise;
        await walletBalances.load({
          miningAccountAddress: config.miningAccount.address,
          vaultingAccountAddress: config.vaultingAccount.address,
        });
        await walletBalances.updateBalances();
        await walletBalances.subscribeToBalanceUpdates();
        await Promise.all([stats.isLoadedPromise, currency.isLoadedPromise]);
        isLoadedResolve();
        isLoaded.value = true;
      } catch (error) {
        const shouldRetry = await askDialog('Wallets failed to load correctly. Would you like to retry?', {
          title: 'Difficulty Loading Wallets',
          kind: 'warning',
        });
        if (!shouldRetry) {
          throw error;
        }
      }
    }
  }

  load().catch(error => {
    console.log('Error loading wallets:', error);
    void handleUnknownFatalError();
    isLoadedReject();
  });

  botEmitter.on('status-changed', status => {
    if (isLoaded.value && status === BotStatus.Ready) {
      // Reload balances when bot status changes
      walletBalances.updateBalances().catch(error => {
        console.error('Error reloading wallet balances:', error);
      });
    }
  });

  return {
    isLoaded,
    isLoadedPromise,
    miningWallet,
    vaultingWallet,
    totalWalletMicrogons,
    totalWalletMicronots,
    miningSeatValue,
    miningBidValue,
    totalMiningMicrogons,
    totalMiningResources,
    totalVaultingResources,
    totalNetWorth,
  };
});
