import * as Vue from 'vue';
import { Config } from '../lib/Config';
import { getDbPromise } from './helpers/dbPromise';
import handleUnknownFatalError from './helpers/handleUnknownFatalError';

let config: Vue.Reactive<Config>;

export type { Config };

export function useConfig(): Vue.Reactive<Config> {
  if (!config) {
    const dbPromise = getDbPromise();
    config = Vue.reactive(new Config(dbPromise));
    config.load().catch(handleUnknownFatalError);
  }

  return config;
}
