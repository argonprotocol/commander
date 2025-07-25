import * as Vue from 'vue';
import { defineStore } from 'pinia';
import basicEmitter from '../emitters/basicEmitter';
import { useConfig } from './config';
import { createDeferred } from '../lib/Utils';
import handleUnknownFatalError from './helpers/handleUnknownFatalError';

export const useController = defineStore('controller', () => {
  const isLoaded = Vue.ref(false);
  const { promise: isLoadedPromise, resolve: isLoadedResolve, reject: isLoadedReject } = createDeferred<void>();

  const config = useConfig();
  const panel = Vue.ref('mining');

  function setPanel(value: string) {
    if (panel.value === value) return;

    basicEmitter.emit('closeAllOverlays');
    panel.value = value;
  }

  async function load() {
    await config.isLoadedPromise;
    isLoaded.value = true;
    isLoadedResolve();
  }

  load().catch(handleUnknownFatalError);

  return {
    panel,
    setPanel,
    isLoaded,
    isLoadedPromise,
  };
});
