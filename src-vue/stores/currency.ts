import * as Vue from 'vue';
import { Currency } from '../lib/Currency';
import handleUnknownFatalError from './helpers/handleUnknownFatalError';
import { useConfig, Config } from './config';
import { getPriceIndex } from './mainchain.ts';

let currency: Vue.Reactive<Currency>;

export type { Currency };

export function useCurrency(): Vue.Reactive<Currency> {
  if (!currency) {
    console.log('Initializing currency');
    const config = useConfig();
    currency = Vue.reactive(new Currency(config as Config, getPriceIndex()));
    currency.load().catch(handleUnknownFatalError);
  }

  return currency;
}
