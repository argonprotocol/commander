import * as Vue from 'vue'
import { defineStore } from 'pinia'
import mainchain from '../lib/Mainchain';
import { invoke } from "@tauri-apps/api/core";
import { Keyring, mnemonicGenerate, type KeyringPair } from '@argonprotocol/mainchain';
import { u8aToHex } from '@polkadot/util';

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
export type ICurrency = Currency.ARGN | Currency.USD | Currency.EURO | Currency.GBP | Currency.INR;

export const useAccountStore = defineStore('account', () => {
  let seedAccount: KeyringPair;

  const isLoaded = Vue.ref(false);
    
  const exchangeRates = <Record<ICurrency | 'ARGNOT', number>>{
    ARGN: 1,
    ARGNOT: 1,
    USD: 1,
    EURO: 1,
    GBP: 1,
    INR: 1,
  };
  
  const seedAddress = Vue.ref('');
  const mngAddress = Vue.ref('');
  const llbAddress = Vue.ref('');
  const vltAddress = Vue.ref('');

  const publicKey = Vue.ref('');
  const argonBalance = Vue.ref(0);
  const argonotBalance = Vue.ref(0);
  const walletBalance = Vue.computed(() => argonBalance.value + argonotToArgon(argonotBalance.value));
  const biddingConfig: any | null = Vue.ref(null);
  const requiresPassword = Vue.ref(false);

  const displayCurrencies: Record<ICurrency, ICurrencyRecord> = {
    [Currency.ARGN]: { id: Currency.ARGN, symbol: '₳', name: 'Argon' },
    [Currency.USD]: { id: Currency.USD, symbol: '$', name: 'Dollar' },
    [Currency.EURO]: { id: Currency.EURO, symbol: '€', name: 'Euro' },
    [Currency.GBP]: { id: Currency.GBP, symbol: '£', name: 'Pound' },
    [Currency.INR]: { id: Currency.INR, symbol: '₹', name: 'Rupee' },
  };
  const displayCurrency = Vue.ref<ICurrencyRecord>(displayCurrencies[Currency.USD]);
  const currencySymbol = Vue.ref(displayCurrency.value.symbol);

  Vue.watch(() => displayCurrency.value, () => {
    currencySymbol.value = displayCurrency.value.symbol;
  });

  function setDisplayCurrency(currency: ICurrency) {
    displayCurrency.value = displayCurrencies[currency];
  }

  async function loadExchangeRates() {
    const [otherResponse, argonResponse] = await Promise.all([
      fetch('https://open.er-api.com/v6/latest/USD'),
      mainchain.fetchExchangeRates()
    ]);
    
    exchangeRates.USD = argonResponse.USD;
    exchangeRates.ARGNOT = argonResponse.ARGNOT;

    const otherData = await otherResponse.json();
    if (!otherData.rates) return;

    exchangeRates.EURO = otherData.rates.EUR / exchangeRates.USD;
    exchangeRates.GBP = otherData.rates.GBP / exchangeRates.USD; 
    exchangeRates.INR = otherData.rates.INR / exchangeRates.USD;
  }

  async function loadBalance(address: string) {
    const client = await mainchain.client;
    const { data: balance } = await client.query.system.account(address);
    const ownership = await client.query.ownership.account(address);
    
    argonBalance.value = 100; //Math.round(Number(balance.free.toPrimitive()) / 1_000_000);
    argonotBalance.value = 12; // Math.round(Number(ownership.free.toPrimitive()) / 1_000_000);
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

  async function createAccount() {
    const mnemonics = mnemonicGenerate();

    seedAccount = new Keyring().createFromUri(mnemonics, { type: 'sr25519' });
    seedAddress.value = seedAccount.address;
    publicKey.value = u8aToHex(seedAccount.publicKey);

    const mngAccount = seedAccount.derive(`//mng`);
    const llbAccount = seedAccount.derive(`//llb`);
    const vltAccount = seedAccount.derive(`//vlt`);

    mngAddress.value = mngAccount.address;
    llbAddress.value = llbAccount.address;
    vltAddress.value = vltAccount.address;

    const payload = {
      address: seedAddress.value,
      privateJson: JSON.stringify(seedAccount.toJson('')),
      requiresPassword: false
    }
    await invoke('initialize_account', payload);
  }

  async function load() {
    try {
      const response = await invoke('fetch_account') as { address: string, biddingConfig: any, requiresPassword: boolean };
      seedAddress.value = response.address;
      biddingConfig.value = response.biddingConfig;
      requiresPassword.value = response.requiresPassword;
    } catch (error) {
      if (error === 'AccountEmpty') {
        createAccount();
      } else throw error;
    }
    await Promise.all([
      loadExchangeRates(),
      loadBalance(seedAddress.value),
    ]);
    isLoaded.value = true;
  }

  load().catch(error => console.error(error));

  return { 
    isLoaded,
    seedAddress,
    mngAddress,
    llbAddress,
    vltAddress,
    argonBalance, 
    argonotBalance, 
    displayCurrency, 
    displayCurrencies, 
    walletBalance, 
    currencySymbol,
    biddingConfig,
    setDisplayCurrency,
    argonTo, 
    argonotTo, 
    argonotToArgon 
  };
});