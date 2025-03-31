<template>
  <div>
    <div class="flex flex-row justify-between items-center w-full pt-5 pr-5 space-x-4">
      <ChevronLeftIcon @click="goBack" class="w-6 h-6 cursor-pointer" />
      <div class="text-2xl font-bold grow">Send Tokens To</div>
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
import { ChevronLeftIcon, XMarkIcon } from '@heroicons/vue/24/outline';

const emit = defineEmits(['navigate']);

function goBack() {
  emit('navigate', { screen: 'main' });
}

function closeWalletOverlay() {
  emit('navigate', { close: true });
}
</script>