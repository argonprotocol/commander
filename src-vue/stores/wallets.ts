import * as Vue from 'vue';
import { defineStore } from 'pinia';
import { ask } from '@tauri-apps/plugin-dialog';
import { getMainchainClient } from '../stores/mainchain.ts';
import handleUnknownFatalError from './helpers/handleUnknownFatalError.ts';
import { useConfig } from './config.ts';
import { createPromiser } from '../lib/Utils.ts';
import { useStats } from './stats.ts';
import { useCurrency } from './currency.ts';

const config = useConfig();

export interface IWallet {
  name: string;
  address: string;
  availableMicrogons: bigint;
  availableMicronots: bigint;
  reservedMicronots: bigint;
}

export const useWallets = defineStore('wallets', () => {
  const stats = useStats();
  const currency = useCurrency();

  const isLoaded = Vue.ref(false);
  const { promise: isLoadedPromise, resolve: isLoadedResolve, reject: isLoadedReject } = createPromiser<void>();

  const miningWallet = Vue.reactive<IWallet>({
    name: 'Mining Wallet',
    address: '',
    availableMicrogons: 0n,
    availableMicronots: 0n,
    reservedMicronots: 0n,
  });

  const vaultingWallet = Vue.reactive<IWallet>({
    name: 'Volatility Wallet',
    address: '',
    availableMicrogons: 0n,
    availableMicronots: 0n,
    reservedMicronots: 0n,
  });

  const miningSeatValue = Vue.computed(() => {
    return (
      stats.myMiningSeats.microgonsToBeMined +
      currency.micronotToMicrogon(stats.myMiningSeats.micronotsToBeMined) +
      currency.micronotToMicrogon(stats.myMiningSeats.micronotsMined) +
      (stats.myMiningSeats.microgonsMinted || 0n) +
      (stats.myMiningSeats.microgonsMined || 0n)
    );
  });

  const totalWalletMicrogons = Vue.ref(0n);
  const totalWalletMicronots = Vue.ref(0n);

  function loadArgonBalance(wallet: IWallet) {
    return new Promise<void>(async (resolve, _) => {
      const client = await getMainchainClient();
      client.query.system.account(wallet.address, result => {
        const availableMicrogons = result.data.free.toBigInt();
        const availableMicrogonsDiff = availableMicrogons - wallet.availableMicrogons;

        wallet.availableMicrogons = availableMicrogons;

        totalWalletMicrogons.value += availableMicrogonsDiff;
        resolve();
      });
    });
  }

  function loadArgonotBalance(wallet: IWallet) {
    return new Promise<void>(async (resolve, _) => {
      const client = await getMainchainClient();
      client.query.ownership.account(wallet.address, result => {
        const availableMicronots = result.free.toBigInt();
        const reservedMicronots = result.reserved.toBigInt();
        const micronotsDiff = availableMicronots + reservedMicronots - wallet.availableMicronots;

        wallet.availableMicronots = availableMicronots;
        wallet.reservedMicronots = reservedMicronots;

        totalWalletMicronots.value += micronotsDiff;
        resolve();
      });
    });
  }

  async function loadBalances() {
    await config.isLoadedPromise;
    miningWallet.address = config.miningAccount.address;
    vaultingWallet.address = config.vaultingAccount.address;

    for (const wallet of [miningWallet, vaultingWallet]) {
      await Promise.all([loadArgonBalance(wallet), loadArgonotBalance(wallet)]);
    }
  }

  //////////////////////////////////////////////////////////////////////////////

  async function load() {
    while (!isLoaded.value) {
      try {
        await loadBalances();
        await Promise.all([stats.isLoadedPromise, currency.isLoadedPromise]);
        isLoadedResolve();
      } catch (error) {
        await ask('Wallets failed to load correctly. Click Ok to try again.', {
          title: 'Argon Commander',
          kind: 'warning',
        });
        continue;
      }
      isLoaded.value = true;
    }
  }

  load().catch(error => {
    console.log('Error loading wallets:', error);
    handleUnknownFatalError();
    isLoadedReject();
  });

  return {
    isLoaded,
    isLoadedPromise,
    miningWallet,
    vaultingWallet,
    totalWalletMicrogons,
    totalWalletMicronots,
    miningSeatValue,
  };
});
