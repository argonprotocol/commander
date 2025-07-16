import * as Vue from 'vue';
import { Config, NETWORK_NAME } from '../lib/Config';
import { getDbPromise } from './helpers/dbPromise';
import handleUnknownFatalError from './helpers/handleUnknownFatalError';
import { SSH } from '../lib/SSH';

let config: Vue.Reactive<Config>;

export { NETWORK_NAME };
export type { Config };

export function useConfig(): Vue.Reactive<Config> {
  if (!config) {
    console.log('Initializing config');
    const dbPromise = getDbPromise();
    config = Vue.reactive(new Config(dbPromise));
    config.load().catch(handleUnknownFatalError);
    SSH.setConfig(config as Config);
  }

  return config;
}
