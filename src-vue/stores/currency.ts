import * as Vue from 'vue';
import { Currency, CurrencyKey } from '../lib/Currency';
import handleUnknownFatalError from './helpers/handleUnknownFatalError';

let currency: Vue.Reactive<Currency>;

export type { Currency };

export function useCurrency(): Vue.Reactive<Currency> {
  if (!currency) {
    console.log('Initializing currency');
    currency = Vue.reactive(new Currency(CurrencyKey.ARGN));
    currency.load().catch(handleUnknownFatalError);
  }

  return currency;
}
