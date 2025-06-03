import * as Vue from 'vue';
import { defineStore } from 'pinia';
import { type IBiddingRules } from '@argonprotocol/commander-calculator';
import { invoke } from '@tauri-apps/api/core';
import { Keyring, mnemonicGenerate } from '@argonprotocol/mainchain';
import { listen } from '@tauri-apps/api/event';
import { message } from '@tauri-apps/plugin-dialog';
import { getMainchain, getMainchainClient } from '../lib/mainchain.ts';
import { exit } from '@tauri-apps/plugin-process';

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

export interface IGlobalStats {
  activeCohorts: number;
  activeSeats: number;
  totalBlocksMined: number;
  totalArgonsBid: number;
  totalArgonsMinted: number;
  totalArgonsMined: number;
  totalTransactionFees: number;
  totalArgonotsMined: number;
  totalArgonsEarned: number;
  totalArgonsInvested: number;
}

export interface ICohortStats {
  frameIdAtCohortActivation: number;
  transactionFees: number;
  argonotsStaked: number;
  argonsBid: number;
  seatsWon: number;
  blocksMined: number;
  argonotsMined: number;
  argonsMined: number;
  argonsMinted: number;
  argonsInvested: number;
  argonsEarned: number;
  frameTickStart: number;
  frameTickEnd: number;
}

export type ICurrency =
  | Currency.ARGN
  | Currency.USD
  | Currency.EURO
  | Currency.GBP
  | Currency.INR;

export const useConfigStore = defineStore('config', () => {
  const version = Vue.ref('');
  const isLoaded = Vue.ref(false);
  const isDataSyncing = Vue.ref(false);

  const dataSync = Vue.ref({
    type: 'server',
    progress: 0,
  });

  const serverDetails = Vue.ref<any>({});
  const installStatus = Vue.ref<any>({});

  const exchangeRates = <Record<ICurrency | 'ARGNOT' | 'BTC', number>>{
    ARGN: 1,
    ARGNOT: 1,
    USD: 1,
    EURO: 1,
    GBP: 1,
    INR: 1,
    BTC: 1,
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

  const stats = Vue.ref<any>({});

  const displayCurrencies: Record<ICurrency, ICurrencyRecord> = {
    [Currency.ARGN]: { id: Currency.ARGN, symbol: '₳', name: 'Argon' },
    [Currency.USD]: { id: Currency.USD, symbol: '$', name: 'Dollar' },
    [Currency.EURO]: { id: Currency.EURO, symbol: '€', name: 'Euro' },
    [Currency.GBP]: { id: Currency.GBP, symbol: '£', name: 'Pound' },
    [Currency.INR]: { id: Currency.INR, symbol: '₹', name: 'Rupee' },
  };
  
  const displayCurrency = Vue.ref<ICurrencyRecord>(
    displayCurrencies[Currency.USD],
  );

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

  async function loadAccounts(security?: { walletMnemonic: string; sessionMnemonic: string }) {
    security = security || (await createSecurity());

    walletMnemonic.value = security.walletMnemonic;
    sessionMnemonic.value = security.sessionMnemonic;

    const seedAccount = new Keyring({ type: 'sr25519' }).createFromUri(
      security.walletMnemonic,
    );
    const mngAccount = seedAccount.derive(`//mng`);
    const llbAccount = seedAccount.derive(`//llb`);
    const vltAccount = seedAccount.derive(`//vlt`);

    mngWallet.address = mngAccount.address;
    llbWallet.address = llbAccount.address;
    vltWallet.address = vltAccount.address;
  }

  async function createSecurity(): Promise<{
    walletMnemonic: string;
    sessionMnemonic: string;
  }> {
    const security = {
      walletMnemonic: mnemonicGenerate(),
      sessionMnemonic: mnemonicGenerate(),
    };
    
    const seedAccount = new Keyring({ type: 'sr25519' }).createFromUri(
      security.walletMnemonic,
    );
    const mngAccount = seedAccount.derive(`//mng`);
    const walletJson = JSON.stringify(mngAccount.toJson(''));

    await invoke('save_security', { ...security, walletJson });

    return security;
  }

  async function addServer(ipAddress: string) {
    await invoke('add_server', { ipAddress });
    serverDetails.value.isConnected = true;
    serverDetails.value.isInstalling = true;
    serverDetails.value.isNewServer = true;
    serverDetails.value.isInstallingFresh = true;
    serverDetails.value.ipAddress = ipAddress;
  }

  async function removeServer() {
    await invoke('remove_server');
    serverDetails.value.isConnected = false;
    serverDetails.value.isInstalling = false;
    serverDetails.value.isInstallingFresh = false;
    serverDetails.value.hasError = false;
    serverDetails.value.ipAddress = '';
  }

  async function launchMiningBot() {
    await invoke('launch_mining_bot', {});

    await new Promise(resolve => setTimeout(resolve, 1000));
    serverDetails.value.isReadyForMining = true;
  }

  async function updateBiddingRules(rules: IBiddingRules) {
    await invoke('update_bidding_rules', {
      biddingRules: rules,
    });
    biddingRules.value = rules;
  }

  // BIDDER DATA //////////////////////////////////////////////////////////////
  const myBidsCallbackFns: ((currentBids: any) => void)[] = [];

  function subscribeToMyBids(callbackFn: (currentBids: any) => void) {
    myBidsCallbackFns.push(callbackFn);
  }

  //////////////////////////////////////////////////////////////////////////////

  async function handleUnknownFatalError() {
    await message('An unknown server error occurred. Please restart the application.', {
      title: 'Unknown Server Error',
      kind: 'error',
    });
  }

  async function load() {
    await listen('FatalServerError', async (event: any) => {
      handleUnknownFatalError();
    });

    await listen('CurrentBids', (event: any) => {
      for (const callbackFn of myBidsCallbackFns) {
        callbackFn(event.payload);
      }
    });

    await listen('DataSync', (event: any) => {
      isDataSyncing.value = event.payload.progress < 100;
      dataSync.value = event.payload;
    });

    const response = (await invoke('start', {})) as {
      version: string;
      security?: { walletMnemonic: string; sessionMnemonic: string };
      biddingRules: any;
      serverDetails: any;
      installStatus: {
        server: any;
        client: any;
      };
      requiresPassword: boolean;
      stats: any;
    };

    console.log('response', response);
    version.value = response.version;

    biddingRules.value = response.biddingRules;
    requiresPassword.value = response.requiresPassword;

    stats.value = response.stats;

    serverDetails.value = { ...response.serverDetails };
    installStatus.value = { ...response.installStatus };

    await loadAccounts(response.security);
    try {
      await loadExchangeRates();
    } catch (error) {
      await message('Failed to load exchange rates.', {
        title: 'Argon Commander',
        kind: 'error',
      });
    }
    await loadBalances();

    isLoaded.value = true;
  }

  load().catch(error => {
    console.error(`Error loading config: ${error}`);
    handleUnknownFatalError();
  });

  return {
    version,
    isLoaded,
    isDataSyncing,
    dataSync,
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
    serverDetails,
    installStatus,
    stats,
    setDisplayCurrency,
    argonTo,
    toArgon,
    argonotTo,
    argonotToArgon,
    btcTo,
    btcToArgon,
    addServer,
    removeServer,
    launchMiningBot,
    updateBiddingRules,
    subscribeToMyBids,
  };
});
