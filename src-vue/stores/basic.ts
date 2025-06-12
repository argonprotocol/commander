import * as Vue from 'vue';
import { defineStore } from 'pinia';
import emitter from '../emitters/basic';

export const useBasicStore = defineStore('basic', () => {
  const panel = Vue.ref('mining');

  function setPanel(value: string) {
    if (panel.value === value) return;

    emitter.emit('closeAllOverlays');
    panel.value = value;
  }

  return {
    panel,
    setPanel,
  };
});
