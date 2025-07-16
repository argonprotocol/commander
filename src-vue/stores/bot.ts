import * as Vue from 'vue';
import { getDbPromise } from './helpers/dbPromise';
import handleUnknownFatalError from './helpers/handleUnknownFatalError';
import { Bot } from '../lib/Bot';
import { useConfig, Config } from './config';

let bot: Vue.Reactive<Bot>;

export type { Bot };

export function useBot(): Vue.Reactive<Bot> {
  if (!bot) {
    const config = useConfig();
    const dbPromise = getDbPromise();
    bot = Vue.reactive(new Bot(config as Config, dbPromise));
    bot.load().catch(handleUnknownFatalError);
  }

  return bot;
}
