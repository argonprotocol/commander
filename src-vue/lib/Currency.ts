import { getMainchain } from '../stores/mainchain';
import BigNumber from 'bignumber.js';

export const MICROGONS_PER_ARGON = 1_000_000;
export const MICRONOTS_PER_ARGONOT = 1_000_000;
export const SATOSHIS_PER_BITCOIN = 100_000_000;

export interface ICurrencyRecord {
  key: ICurrencyKey;
  symbol: string;
  name: string;
}

export type IExchangeRates = Record<ICurrencyKey | 'ARGNOT' | 'BTC', BigNumber>;

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
  public argonExchangeRateTo: IExchangeRates = {
    ARGN: BigNumber(1),
    ARGNOT: BigNumber(1),
    USD: BigNumber(1),
    EUR: BigNumber(1),
    GBP: BigNumber(1),
    INR: BigNumber(1),
    BTC: BigNumber(1),
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

  constructor(defaultCurrencyKey: ICurrencyKey) {
    this.setCurrencyKey(defaultCurrencyKey);
  }

  public setCurrencyKey(currencyKey: ICurrencyKey) {
    this.record = this.records[currencyKey];
    this.symbol = this.record.symbol;
  }

  async load() {
    const [otherResponse, argonExchangeRateTo] = await Promise.all([
      fetch('https://open.er-api.com/v6/latest/USD'),
      getMainchain().fetchArgonExchangeRatesTo(),
    ]);

    this.argonExchangeRateTo.USD = argonExchangeRateTo.USD;
    this.argonExchangeRateTo.ARGNOT = argonExchangeRateTo.ARGNOT;
    this.argonExchangeRateTo.BTC = argonExchangeRateTo.BTC;

    const otherData = await otherResponse.json();
    if (!otherData.rates) return;

    this.argonExchangeRateTo.EUR = BigNumber(otherData.rates.EUR).multipliedBy(this.argonExchangeRateTo.USD);
    this.argonExchangeRateTo.GBP = BigNumber(otherData.rates.GBP).multipliedBy(this.argonExchangeRateTo.USD);
    this.argonExchangeRateTo.INR = BigNumber(otherData.rates.INR).multipliedBy(this.argonExchangeRateTo.USD);
  }

  public microgonToArgon(microgons: bigint): number {
    if (!microgons) return 0;
    return Number(microgons) / MICROGONS_PER_ARGON;
  }

  public microgonTo(microgons: bigint): number {
    const argons = this.microgonToArgon(microgons);
    return this.argonTo(argons);
  }

  public argonTo(argons: number): number {
    if (this.record.key === CurrencyKey.USD) {
      return BigNumber(argons).dividedBy(this.argonExchangeRateTo.USD).toNumber();
    } else if (this.record.key === CurrencyKey.EUR) {
      return BigNumber(argons).dividedBy(this.argonExchangeRateTo.EUR).toNumber();
    } else if (this.record.key === CurrencyKey.GBP) {
      return BigNumber(argons).dividedBy(this.argonExchangeRateTo.GBP).toNumber();
    } else if (this.record.key === CurrencyKey.INR) {
      return BigNumber(argons).dividedBy(this.argonExchangeRateTo.INR).toNumber();
    } else {
      return argons;
    }
  }

  public toMicrogon(value: number): bigint {
    let exchangeRate = BigNumber(1);
    if (this.record.key === CurrencyKey.USD) {
      exchangeRate = this.argonExchangeRateTo.USD;
    } else if (this.record.key === CurrencyKey.EUR) {
      exchangeRate = this.argonExchangeRateTo.EUR;
    } else if (this.record.key === CurrencyKey.GBP) {
      exchangeRate = this.argonExchangeRateTo.GBP;
    } else if (this.record.key === CurrencyKey.INR) {
      exchangeRate = this.argonExchangeRateTo.INR;
    } else {
      throw new Error(`Invalid currency key: ${this.record.key}`);
    }
    return BigInt(BigNumber(value).multipliedBy(exchangeRate).multipliedBy(MICROGONS_PER_ARGON).toNumber());
  }

  public micronotToMicrogon(micronots: bigint): bigint {
    if (!micronots) return 0n;
    const microgonsBn = BigNumber(micronots.toString()).multipliedBy(this.argonExchangeRateTo.ARGNOT);
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

  public btcToMicrogon(bitcoins: number): bigint {
    const satoshis = Math.floor(bitcoins * SATOSHIS_PER_BITCOIN);
    const microgons = BigNumber(satoshis)
      .multipliedBy(this.argonExchangeRateTo.BTC)
      .multipliedBy(MICROGONS_PER_ARGON)
      .dividedBy(SATOSHIS_PER_BITCOIN);
    return BigInt(Math.floor(microgons.toNumber()));
  }
}
