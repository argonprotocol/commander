import * as Vue from 'vue'
import { defineStore } from 'pinia'
import mainchain, { type MainchainClient } from '../lib/bidding-calculator/Mainchain';
import { invoke } from "@tauri-apps/api/core";
import { Keyring, mnemonicGenerate } from '@argonprotocol/mainchain';
import Provisioner, { IStep } from '../lib/Provisioner';
import emitter from '../emitters/basic';
import type IBiddingRules from '../lib/bidding-calculator/IBiddingRules';
import { listen } from '@tauri-apps/api/event';

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

export interface IArgonActivity {
  localhostBlockNumber: number;
  mainchainBlockNumber: number;
  insertedAt: string;
}

export interface IBitcoinActivity {
  localhostBlockNumber: number;
  mainchainBlockNumber: number;
  insertedAt: string;
}

export interface IBotActivity {
  action: string;
  insertedAt: string;
}

export type ICurrency = Currency.ARGN | Currency.USD | Currency.EURO | Currency.GBP | Currency.INR;

export const useConfigStore = defineStore('config', () => {
  const isLoaded = Vue.ref(false);
  const provisioner = new Provisioner();

  provisioner.finishedFn = () => {
    emitter.emit('openProvisioningCompleteOverlay');
  }

  const serverConnection = Vue.reactive({
    isConnected: false,
    isProvisioned: provisioner.isProvisioned,
    isReadyForMining: false,
    hasMiningSeats: false,
    hasError: provisioner.hasError,
    errorType: provisioner.errorType,
    ipAddress: '',
    sshPublicKey: '',
    steps: provisioner.steps,
  });

  const exchangeRates = <Record<ICurrency | 'ARGNOT', number>>{
    ARGN: 1,
    ARGNOT: 1,
    USD: 1,
    EURO: 1,
    GBP: 1,
    INR: 1,
  };
  
  const walletMnemonic = Vue.ref('');
  const sessionMnemonic = Vue.ref('');

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
  
  const biddingRules: Vue.Ref<IBiddingRules | null> = Vue.ref(null);
  const requiresPassword = Vue.ref(false);

  const argonActivity = Vue.ref<IArgonActivity[]>([]);
  const bitcoinActivity = Vue.ref<IBitcoinActivity[]>([]);
  const botActivity = Vue.ref<IBotActivity[]>([]);

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
    exchangeRates.ARGNOT = argonResponse.ARGNOT || 5;

    const otherData = await otherResponse.json();
    if (!otherData.rates) return;

    exchangeRates.EURO = otherData.rates.EUR / exchangeRates.USD;
    exchangeRates.GBP = otherData.rates.GBP / exchangeRates.USD; 
    exchangeRates.INR = otherData.rates.INR / exchangeRates.USD;
  }

  function loadArgonBalance(wallet: IWallet) {
    return new Promise(async (resolve, _) => {
      const client: MainchainClient = await mainchain.client;
      client.query.system.account(wallet.address, (result) => {
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
      const client: MainchainClient = await mainchain.client;
      client.query.ownership.account(wallet.address, (result) => {
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
    for (const wallet of [mngWallet, llbWallet, vltWallet]) {
      await Promise.all([
        loadArgonBalance(wallet),
        loadArgonotBalance(wallet)
      ]);
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

  async function loadAccounts(mnemonics?: { wallet: string, session: string }) {
    mnemonics = mnemonics || await createMnemonics();

    walletMnemonic.value = mnemonics.wallet;
    sessionMnemonic.value = mnemonics.session;

    const seedAccount = new Keyring({ type: 'sr25519' }).createFromUri(mnemonics.wallet);
    const mngAccount = seedAccount.derive(`//mng`);
    const llbAccount = seedAccount.derive(`//llb`);
    const vltAccount = seedAccount.derive(`//vlt`);

    mngWallet.address = mngAccount.address;
    llbWallet.address = llbAccount.address;
    vltWallet.address = vltAccount.address;
  }

  async function createMnemonics(): Promise<{ wallet: string, session: string }> {
    const mnemonics = {
      wallet: mnemonicGenerate(),
      session: mnemonicGenerate(),
    }

    await invoke('create_mnemonics', mnemonics);

    return mnemonics;
  }

  async function connectServer(ipAddress: string) {
    await invoke('connect_server', { ipAddress });

    provisioner.setIpAddress(ipAddress);
    serverConnection.isConnected = true;
    provisioner.run();
  }

  async function removeServer() {
    await invoke('remove_server');
    serverConnection.isConnected = false;
    serverConnection.isProvisioned = false;
    serverConnection.hasError = false;
    serverConnection.ipAddress = '';
  }

  async function runRetryStep(step: IStep) {
    const stepKey = step.key === 'ssh' ? 'all' : step.key;
    provisioner.resetStep(step);
    await invoke('retry_provisioning', { stepKey });
  }

  async function createServerSecurityVariables() {
    const seedAccount = new Keyring({ type: 'sr25519' }).createFromUri(walletMnemonic.value);
    const mngAccount = seedAccount.derive(`//mng`);
    const walletJson = JSON.stringify(mngAccount.toJson(''));

    return { walletJson, sessionMnemonic: sessionMnemonic.value };
  }

  async function launchMiningBot() {
    const { walletJson, sessionMnemonic } = await createServerSecurityVariables();
    await invoke('launch_mining_bot', { walletJson, sessionMnemonic });

    await new Promise(resolve => setTimeout(resolve, 1000));
    serverConnection.isReadyForMining = true;
  }

  async function updateBiddingRules(rules: IBiddingRules) {
    const { walletJson, sessionMnemonic } = await createServerSecurityVariables();
    await invoke('update_bidding_rules', { biddingRules: rules, walletJson, sessionMnemonic });
    biddingRules.value = rules;
  }

  // BIDDER DATA //////////////////////////////////////////////////////////////
  const bidderDataCallbackFns: ((bidderData: any) => void)[] = [];

  function subscribeToBidderData(callbackFn: (bidderData: any) => void) {
    bidderDataCallbackFns.push(callbackFn);
  }

  //////////////////////////////////////////////////////////////////////////////

  async function load() {
    await listen('bidderData', (event: any) => {
      for (const callbackFn of bidderDataCallbackFns) {
        callbackFn(event.payload);
      }
    });

    await listen('argonActivity', (event: any) => {
      argonActivity.value.unshift(event.payload);
      argonActivity.value.splice(10);
    });

    await listen('bitcoinActivity', (event: any) => {
      bitcoinActivity.value.unshift(event.payload);
      bitcoinActivity.value.splice(10);
    });

    await listen('botActivity', (event: any) => {
      botActivity.value.unshift(event.payload);
      botActivity.value.splice(10);
    });

    const response = await invoke('start', {}) as { 
      mnemonics?: { wallet: string, session: string }, 
      biddingRules: any, 
      serverConnection: any, 
      serverStatus: any,
      serverProgress: any,
      requiresPassword: boolean,
      argonActivity: IArgonActivity[],
      bitcoinActivity: IBitcoinActivity[],
      botActivity: IBotActivity[],
    };
    biddingRules.value = response.biddingRules;
    requiresPassword.value = response.requiresPassword;
    
    argonActivity.value = response.argonActivity;
    bitcoinActivity.value = response.bitcoinActivity;
    botActivity.value = response.botActivity;

    serverConnection.isConnected = response.serverConnection.isConnected;
    serverConnection.isProvisioned = response.serverConnection.isProvisioned || false;
    serverConnection.isReadyForMining = response.serverConnection.isReadyForMining || false;
    serverConnection.hasMiningSeats = response.serverConnection.hasMiningSeats || false;
    serverConnection.ipAddress = response.serverConnection.ipAddress;
    serverConnection.sshPublicKey = response.serverConnection.sshPublicKey;
    provisioner.setIpAddress(response.serverConnection.ipAddress);
    provisioner.updateServerStatus(response.serverStatus);

    if (serverConnection.isConnected && !serverConnection.isProvisioned) {
      provisioner.run(response.serverProgress);
    }

    await loadAccounts(response.mnemonics);
    await loadExchangeRates();
    await loadBalances();

    isLoaded.value = true;
  }

  load().catch(error => console.error(`Error loading config: ${error}`));

  return { 
    isLoaded,
    walletMnemonic,
    mngWallet,
    llbWallet,
    vltWallet,
    totalArgons,
    totalArgonots,
    totalWalletValue,
    displayCurrency, 
    displayCurrencies, 
    currencySymbol,
    biddingRules,
    serverConnection,
    argonActivity,
    bitcoinActivity,
    botActivity,
    setDisplayCurrency,
    argonTo,
    toArgon,
    argonotTo, 
    argonotToArgon,
    connectServer,
    removeServer,
    runRetryStep,
    launchMiningBot,
    updateBiddingRules,
    subscribeToBidderData,
  };
});