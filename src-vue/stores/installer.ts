import * as Vue from 'vue';
import { useConfig, type Config } from './config';
import Installer from '../lib/Installer';
import handleUnknownFatalError from './helpers/handleUnknownFatalError';

let installer: Vue.Reactive<Installer>;

export type { Installer };

export function useInstaller(): Vue.Reactive<Installer> {
  if (!installer) {
    const config = useConfig();
    installer = Vue.reactive(new Installer(config as Config));
    installer.load().catch(handleUnknownFatalError);
  }

  return installer;
}
