import * as Vue from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
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
    config
      .load()
      .then(() => {
        // Ensure any unsaved changes are saved when the window is closed
        getCurrentWindow().onCloseRequested(async () => {
          await config.save();
        });
      })
      .catch(handleUnknownFatalError);
    SSH.setConfig(config as Config);
  }

  return config;
}
