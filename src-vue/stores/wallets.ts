import * as Vue from 'vue';
import { defineStore } from 'pinia';
import { ask } from '@tauri-apps/plugin-dialog';
import { getMainchainClient } from './mainchain.ts';
import handleUnknownFatalError from './helpers/handleUnknownFatalError.ts';
import { useConfig } from './config.ts';
import { createDeferred } from '../lib/Utils.ts';
import { useStats } from './stats.ts';
import { useCurrency } from './currency.ts';
import { botEmitter } from '../lib/Bot.ts';
import { MainchainClient } from '@argonprotocol/commander-calculator';

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
  const { promise: isLoadedPromise, resolve: isLoadedResolve, reject: isLoadedReject } = createDeferred<void>();

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
    return stats.myMiningSeats.microgonsBid;
  });

  const miningBidValue = Vue.computed(() => {
    return stats.myMiningBids.microgonsBid;
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

  const subscriptions: VoidFunction[] = [];
  function loadArgonBalance(client: MainchainClient, wallet: IWallet) {
    return new Promise<void>(async (resolve, _) => {
      const sub = await client.query.system.account(wallet.address, result => {
        const availableMicrogons = result.data.free.toBigInt();
        const availableMicrogonsDiff = availableMicrogons - wallet.availableMicrogons;

        wallet.availableMicrogons = availableMicrogons;

        totalWalletMicrogons.value += availableMicrogonsDiff;
        resolve();
      });
      subscriptions.push(sub);
    });
  }

  function loadArgonotBalance(client: MainchainClient, wallet: IWallet) {
    return new Promise<void>(async (resolve, _) => {
      const sub = await client.query.ownership.account(wallet.address, result => {
        const availableMicronots = result.free.toBigInt();
        const reservedMicronots = result.reserved.toBigInt();
        const micronotsDiff = availableMicronots + reservedMicronots - wallet.availableMicronots;

        wallet.availableMicronots = availableMicronots;
        wallet.reservedMicronots = reservedMicronots;

        totalWalletMicronots.value += micronotsDiff;
        resolve();
      });
      subscriptions.push(sub);
    });
  }

  async function loadBalances() {
    await config.isLoadedPromise;
    if (subscriptions.length) {
      subscriptions.forEach(x => x());
      subscriptions.length = 0;
    }
    miningWallet.address = config.miningAccount.address;
    vaultingWallet.address = config.vaultingAccount.address;
    const client = await getMainchainClient(true);
    for (const wallet of [miningWallet, vaultingWallet]) {
      await Promise.all([loadArgonBalance(client, wallet), loadArgonotBalance(client, wallet)]);
    }
  }

  //////////////////////////////////////////////////////////////////////////////

  async function load() {
    while (!isLoaded.value) {
      try {
        await loadBalances();
        await Promise.all([stats.isLoadedPromise, currency.isLoadedPromise]);
        isLoadedResolve();
        isLoaded.value = true;
      } catch (error) {
        await ask('Wallets failed to load correctly. Click Ok to try again.', {
          title: 'Argon Commander',
          kind: 'warning',
        });
      }
    }
  }

  load().catch(error => {
    console.log('Error loading wallets:', error);
    void handleUnknownFatalError();
    isLoadedReject();
  });

  botEmitter.on('status-changed', status => {
    if (isLoaded.value && status === 'Ready') {
      // Reload balances when bot status changes
      loadBalances().catch(error => {
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
    totalMiningResources,
    totalVaultingResources,
    totalNetWorth,
  };
});
