<template>
  <div>
    <div class="flex flex-row justify-between items-center w-full pt-5 pr-5 space-x-4">
      <ChevronLeftIcon @click="goBack" class="w-6 h-6 cursor-pointer" />
      <div class="text-2xl font-bold grow">Send {{ walletName }} Wallet Funds</div>
      <XMarkIcon @click="closeWalletOverlay" class="w-6 h-6 cursor-pointer" />
    </div>

    Address:
    <input type="text" class="w-full border border-black/50 rounded-md p-2" />

    Amount:
    <div class="flex flex-row justify-between items-center w-full">
      <input type="text" class="w-full border border-black/50 rounded-md p-2" />
      <button class="w-full border border-black/50 rounded-md p-2">Max</button>
    </div>
    <button class="w-full border border-black/50 rounded-md p-2">Send</button>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { ChevronLeftIcon, XMarkIcon } from '@heroicons/vue/24/outline';

const emit = defineEmits(['navigate']);

const props = defineProps({
  walletId: {
    type: String as Vue.PropType<'mng' | 'llb' | 'vlt'>,
    required: true
  }
});

const walletName = Vue.computed(() => {
  if (props.walletId === 'mng') {
    return 'Mining';
  } else if (props.walletId === 'llb') {
    return 'Liquid Locking';
  } else if (props.walletId === 'vlt') {
    return 'Vaulting';
  }
  return '';
});

function goBack() {
  emit('navigate', { screen: 'main' });
}

function closeWalletOverlay() {
  emit('navigate', { close: true });
}
</script>