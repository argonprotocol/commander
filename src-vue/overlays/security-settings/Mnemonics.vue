<!-- prettier-ignore -->
<template>
  <p class="text-md text-slate-500 px-3">
    The following words constitute your wallet recovery phrase (the order is important). They are used to recover your
    wallet if this device or app is lost or damaged. Keep them in a safe place! Anyone who knows this mnemonic can
    access your wallet and funds.
  </p>

  <ol class="grid grid-cols-3 gap-2 px-3 mt-4 mb-3 ml-6">
    <li v-for="(mnemonic, index) in mnemonics" :key="mnemonic" class="flex items-center gap-2">
      <span class="text-slate-500">{{ index + 1 }}.</span>
      <span>{{ mnemonic }}</span>
    </li>
  </ol>

  <button @click="copyToClipboard" class="w-full bg-slate-600/20 hover:bg-slate-600/15 border border-slate-900/10 inner-button-shadow text-slate-900 px-4 py-1 rounded-lg focus:outline-none">
    {{ isCopied ? 'Copied!' : 'Copy to Clipboard' }}
  </button>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useConfig } from '../../stores/config';

const config = useConfig();
const mnemonics = Vue.computed(() => config.security.walletMnemonic.split(' '));
const isCopied = Vue.ref(false);

const emit = defineEmits(['close', 'goto']);

function closeOverlay() {
  emit('close');
}

function copyToClipboard() {
  navigator.clipboard.writeText(config.security.walletMnemonic);
  isCopied.value = true;
  setTimeout(() => {
    isCopied.value = false;
  }, 2000);
}
</script>
