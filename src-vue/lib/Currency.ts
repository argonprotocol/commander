import BigNumber from 'bignumber.js';
import { getMainchain } from '../stores/mainchain';
import { MICROGONS_PER_ARGON, SATS_PER_BTC } from '@argonprotocol/mainchain';
import { bigNumberToBigInt } from '@argonprotocol/commander-calculator';
import IDeferred from '../interfaces/IDeferred';
import { createDeferred } from './Utils';
import { Config } from './Config';

export const SATOSHIS_PER_BITCOIN = SATS_PER_BTC;
export { MICROGONS_PER_ARGON };
export const MICRONOTS_PER_ARGONOT = 1_000_000;

export interface ICurrencyRecord {
  key: ICurrencyKey;
  symbol: string;
  name: string;
}

export type IExchangeRates = Record<ICurrencyKey | 'ARGNOT' | 'BTC', bigint>;

export enum CurrencyKey {
  ARGN = 'ARGN',
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  INR = 'INR',
}

export type ICurrencyKey = CurrencyKey.ARGN | CurrencyKey.USD | CurrencyKey.EUR | CurrencyKey.GBP | CurrencyKey.INR;

export class Currency {
  // These exchange rates are relative to the argon, which means the ARGN is always 1
  public microgonExchangeRateTo: IExchangeRates = {
    ARGN: BigInt(1 * MICROGONS_PER_ARGON),
    ARGNOT: BigInt(1 * MICROGONS_PER_ARGON),
    USD: BigInt(1 * MICROGONS_PER_ARGON),
    EUR: BigInt(1 * MICROGONS_PER_ARGON),
    GBP: BigInt(1 * MICROGONS_PER_ARGON),
    INR: BigInt(1 * MICROGONS_PER_ARGON),
    BTC: BigInt(1 * MICROGONS_PER_ARGON),
  };

  public records: Record<ICurrencyKey, ICurrencyRecord> = {
    [CurrencyKey.ARGN]: { key: CurrencyKey.ARGN, symbol: '₳', name: 'Argon' },
    [CurrencyKey.USD]: { key: CurrencyKey.USD, symbol: '$', name: 'Dollar' },
    [CurrencyKey.EUR]: { key: CurrencyKey.EUR, symbol: '€', name: 'Euro' },
    [CurrencyKey.GBP]: { key: CurrencyKey.GBP, symbol: '£', name: 'Pound' },
    [CurrencyKey.INR]: { key: CurrencyKey.INR, symbol: '₹', name: 'Rupee' },
  };

  public record!: ICurrencyRecord;
  public symbol!: string;

  public isLoaded: boolean;
  public isLoadedPromise: Promise<void>;

  private config: Config;
  private isLoadedDeferred: IDeferred<void>;

  constructor(config: Config) {
    this.config = config;

    this.isLoaded = false;
    this.isLoadedDeferred = createDeferred<void>();
    this.isLoadedPromise = this.isLoadedDeferred.promise;
  }

  public async load() {
    const [otherResponse, microgonExchangeRateTo] = await Promise.all([
      fetch('https://open.er-api.com/v6/latest/USD'),
      getMainchain().fetchMicrogonExchangeRatesTo(),
    ]);

    this.microgonExchangeRateTo.USD = microgonExchangeRateTo.USD;
    this.microgonExchangeRateTo.ARGNOT = microgonExchangeRateTo.ARGNOT;
    this.microgonExchangeRateTo.BTC = microgonExchangeRateTo.BTC;

    const usdExchangeRateFrom = (await otherResponse.json()).rates;
    if (!usdExchangeRateFrom) return;

    this.microgonExchangeRateTo.EUR = this.otherExchangeRateToMicrogons(usdExchangeRateFrom.EUR);
    this.microgonExchangeRateTo.GBP = this.otherExchangeRateToMicrogons(usdExchangeRateFrom.GBP);
    this.microgonExchangeRateTo.INR = this.otherExchangeRateToMicrogons(usdExchangeRateFrom.INR);

    this.config.isLoadedPromise.then(() => {
      this.setCurrencyKey(this.config.defaultCurrencyKey, false);
      this.isLoaded = true;
      this.isLoadedDeferred.resolve();
    });
  }

  public setCurrencyKey(currencyKey: ICurrencyKey, saveToConfig: boolean = true) {
    this.record = this.records[currencyKey];
    this.symbol = this.record.symbol;
    if (saveToConfig) this.config.defaultCurrencyKey = currencyKey;
  }

  public microgonToArgon(microgons: bigint): number {
    if (!microgons) return 0;
    return Number(microgons) / MICROGONS_PER_ARGON;
  }

  public microgonTo(microgons: bigint): number {
    if (this.record.key === CurrencyKey.USD) {
      return BigNumber(microgons).dividedBy(this.microgonExchangeRateTo.USD).toNumber();
    } else if (this.record.key === CurrencyKey.EUR) {
      return BigNumber(microgons).dividedBy(this.microgonExchangeRateTo.EUR).toNumber();
    } else if (this.record.key === CurrencyKey.GBP) {
      return BigNumber(microgons).dividedBy(this.microgonExchangeRateTo.GBP).toNumber();
    } else if (this.record.key === CurrencyKey.INR) {
      return BigNumber(microgons).dividedBy(this.microgonExchangeRateTo.INR).toNumber();
    } else {
      return this.microgonToArgon(microgons);
    }
  }

  public argonTo(argons: number): number {
    const microgons = this.argonToMicrogon(argons);
    return this.microgonTo(microgons);
  }

  public argonToMicrogon(argons: number): bigint {
    return BigInt(Math.round(argons * MICROGONS_PER_ARGON));
  }

  public toMicrogon(value: number): bigint {
    let exchangeRate = BigInt(1 * MICROGONS_PER_ARGON);
    if (this.record.key === CurrencyKey.USD) {
      exchangeRate = this.microgonExchangeRateTo.USD;
    } else if (this.record.key === CurrencyKey.EUR) {
      exchangeRate = this.microgonExchangeRateTo.EUR;
    } else if (this.record.key === CurrencyKey.GBP) {
      exchangeRate = this.microgonExchangeRateTo.GBP;
    } else if (this.record.key === CurrencyKey.INR) {
      exchangeRate = this.microgonExchangeRateTo.INR;
    } else {
      throw new Error(`Invalid currency key: ${this.record.key}`);
    }
    return bigNumberToBigInt(BigNumber(value).multipliedBy(exchangeRate));
  }

  public micronotToMicrogon(micronots: bigint): bigint {
    if (!micronots) return 0n;
    const argonotsBn = BigNumber(micronots).dividedBy(MICRONOTS_PER_ARGONOT);
    const microgonsBn = argonotsBn.multipliedBy(this.microgonExchangeRateTo.ARGNOT);
    return BigInt(Math.round(microgonsBn.toNumber()));
  }

  public micronotToArgonot(micronots: bigint): number {
    if (!micronots) return 0;
    return Number(micronots) / MICRONOTS_PER_ARGONOT;
  }

  public micronotToArgon(micronots: bigint) {
    const microgons = this.micronotToMicrogon(micronots);
    return this.microgonToArgon(microgons);
  }

  public micronotTo(micronots: bigint): number {
    const microgons = this.micronotToMicrogon(micronots);
    return this.microgonTo(microgons);
  }

  public btcTo(bitcoins: number) {
    const microgons = this.btcToMicrogon(bitcoins);
    return this.microgonTo(microgons);
  }

  public satsToBtc(satoshis: bigint): number {
    if (!satoshis) return 0;
    return Number(satoshis) / Number(SATOSHIS_PER_BITCOIN);
  }

  public btcToMicrogon(bitcoins: number): bigint {
    const microgonsBn = BigNumber(bitcoins).multipliedBy(this.microgonExchangeRateTo.BTC);
    return BigInt(Math.floor(microgonsBn.toNumber()));
  }

  public microgonToBtc(microgons: bigint): number {
    const bitcoinsBn = BigNumber(microgons).dividedBy(this.microgonExchangeRateTo.BTC);
    return bitcoinsBn.toNumber();
  }

  private otherExchangeRateToMicrogons(otherExchangeRate: number): bigint {
    const dollarsRequiredBn = BigNumber(1).dividedBy(otherExchangeRate);
    const microgonsRequiredBn = dollarsRequiredBn.multipliedBy(this.microgonExchangeRateTo.USD);
    return bigNumberToBigInt(microgonsRequiredBn);
  }
}
