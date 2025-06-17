import * as Vue from 'vue';
import { defineStore } from 'pinia';
import { ask } from '@tauri-apps/plugin-dialog';
import { getMainchain, getMainchainClient } from '../stores/mainchain.ts';
import handleUnknownFatalError from './helpers/handleUnknownFatalError.ts';
import { useConfig } from './config.ts';

const config = useConfig();

export interface ICurrencyRecord {
  id: ICurrency;
  symbol: string;
  name: string;
}

export enum Currency {
  ARGN = 'ARGN',
  USD = 'USD',
  EURO = 'EURO',
  GBP = 'GBP',
  INR = 'INR',
}

export interface IWallet {
  name: string;
  address: string;
  argons: number;
  argonots: number;
  totalValue: number;
}

export type ICurrency = Currency.ARGN | Currency.USD | Currency.EURO | Currency.GBP | Currency.INR;

export const useCurrencyStore = defineStore('currency', () => {
  const isLoaded = Vue.ref(false);

  const exchangeRates = <Record<ICurrency | 'ARGNOT' | 'BTC', number>>{
    ARGN: 1,
    ARGNOT: 1,
    USD: 1,
    EURO: 1,
    GBP: 1,
    INR: 1,
    BTC: 1,
  };

  const mngWallet = Vue.reactive<IWallet>({
    name: 'Mining Wallet',
    address: '',
    argons: 0,
    argonots: 0,
    totalValue: 0,
  });

  const llbWallet = Vue.reactive<IWallet>({
    name: 'Liquid Locking Wallet',
    address: '',
    argons: 0,
    argonots: 0,
    totalValue: 0,
  });

  const vltWallet = Vue.reactive<IWallet>({
    name: 'Volatility Wallet',
    address: '',
    argons: 0,
    argonots: 0,
    totalValue: 0,
  });

  const totalArgons = Vue.ref(0);
  const totalArgonots = Vue.ref(0);
  const totalWalletValue = Vue.ref(0);

  const displayCurrencies: Record<ICurrency, ICurrencyRecord> = {
    [Currency.ARGN]: { id: Currency.ARGN, symbol: '₳', name: 'Argon' },
    [Currency.USD]: { id: Currency.USD, symbol: '$', name: 'Dollar' },
    [Currency.EURO]: { id: Currency.EURO, symbol: '€', name: 'Euro' },
    [Currency.GBP]: { id: Currency.GBP, symbol: '£', name: 'Pound' },
    [Currency.INR]: { id: Currency.INR, symbol: '₹', name: 'Rupee' },
  };

  const displayCurrency = Vue.ref<ICurrencyRecord>(displayCurrencies[Currency.USD]);

  const currencySymbol = Vue.ref(displayCurrency.value.symbol);

  Vue.watch(
    () => displayCurrency.value,
    () => {
      currencySymbol.value = displayCurrency.value.symbol;
    },
  );

  function setDisplayCurrency(currency: ICurrency) {
    displayCurrency.value = displayCurrencies[currency];
  }

  async function loadExchangeRates() {
    const [otherResponse, argonResponse] = await Promise.all([
      fetch('https://open.er-api.com/v6/latest/USD'),
      getMainchain().fetchExchangeRates(),
    ]);

    exchangeRates.USD = argonResponse.USD;
    exchangeRates.ARGNOT = argonResponse.ARGNOT || 5;
    exchangeRates.BTC = argonResponse.BTC;

    const otherData = await otherResponse.json();
    if (!otherData.rates) return;

    exchangeRates.EURO = otherData.rates.EUR / exchangeRates.USD;
    exchangeRates.GBP = otherData.rates.GBP / exchangeRates.USD;
    exchangeRates.INR = otherData.rates.INR / exchangeRates.USD;
  }

  function loadArgonBalance(wallet: IWallet) {
    return new Promise(async (resolve, _) => {
      const client = await getMainchainClient();
      client.query.system.account(wallet.address, result => {
        const argons = Number(result.data.free.toPrimitive()) / 1_000_000;
        const totalValue = argons + argonotToArgon(wallet.argonots);

        const argonsDiff = argons - wallet.argons;
        const totalValueDiff = totalValue - wallet.totalValue;

        wallet.argons = argons;
        wallet.totalValue = totalValue;

        totalArgons.value += argonsDiff;
        totalWalletValue.value += totalValueDiff;
        resolve(totalValueDiff);
      });
    });
  }

  function loadArgonotBalance(wallet: IWallet) {
    return new Promise(async (resolve, _) => {
      const client = await getMainchainClient();
      client.query.ownership.account(wallet.address, result => {
        const argonots = Number(result.free.toPrimitive()) / 1_000_000;
        const totalValue = wallet.argons + argonotToArgon(argonots);

        const argonotsDiff = argonots - wallet.argonots;
        const totalValueDiff = totalValue - wallet.totalValue;

        wallet.argonots = argonots;
        wallet.totalValue = totalValue;

        totalArgonots.value += argonotsDiff;
        totalWalletValue.value += totalValueDiff;
        resolve(totalValueDiff);
      });
    });
  }

  async function loadBalances() {
    await config.isLoadedPromise;
    mngWallet.address = config.mngAccount.address;
    llbWallet.address = config.llbAccount.address;
    vltWallet.address = config.vltAccount.address;

    for (const wallet of [mngWallet, llbWallet, vltWallet]) {
      await Promise.all([loadArgonBalance(wallet), loadArgonotBalance(wallet)]);
    }
  }

  function toArgon(qty: number) {
    if (displayCurrency.value.id === Currency.USD) {
      return qty / exchangeRates.USD;
    } else if (displayCurrency.value.id === Currency.EURO) {
      return qty / exchangeRates.EURO;
    } else if (displayCurrency.value.id === Currency.GBP) {
      return qty / exchangeRates.GBP;
    } else if (displayCurrency.value.id === Currency.INR) {
      return qty / exchangeRates.INR;
    } else {
      return qty;
    }
  }

  function argonTo(qtyInArgons: number) {
    if (displayCurrency.value.id === Currency.USD) {
      return qtyInArgons * exchangeRates.USD;
    } else if (displayCurrency.value.id === Currency.EURO) {
      return qtyInArgons * exchangeRates.EURO;
    } else if (displayCurrency.value.id === Currency.GBP) {
      return qtyInArgons * exchangeRates.GBP;
    } else if (displayCurrency.value.id === Currency.INR) {
      return qtyInArgons * exchangeRates.INR;
    } else {
      return qtyInArgons;
    }
  }

  function argonotTo(qty: number) {
    return argonTo(argonotToArgon(qty));
  }

  function argonotToArgon(qty: number) {
    return qty * exchangeRates.ARGNOT;
  }

  function btcTo(qty: number) {
    return argonTo(btcToArgon(qty));
  }

  function btcToArgon(qty: number) {
    return qty * exchangeRates.BTC;
  }

  //////////////////////////////////////////////////////////////////////////////

  async function load() {
    try {
      await loadExchangeRates();
    } catch (error) {
      await ask('Exchange rates failed to load correctly. Click Ok to try again.', {
        title: 'Argon Commander',
        kind: 'warning',
      });
    }

    await loadBalances();
    isLoaded.value = true;
  }

  load().catch(error => {
    console.log('Error loading currency:', error);
    handleUnknownFatalError();
  });

  return {
    isLoaded,
    mngWallet,
    llbWallet,
    vltWallet,
    totalArgons,
    totalArgonots,
    totalWalletValue,
    displayCurrency,
    displayCurrencies,
    currencySymbol,
    setDisplayCurrency,
    argonTo,
    toArgon,
    argonotTo,
    argonotToArgon,
    btcTo,
    btcToArgon,
  };
});
