<template>
  <div>
    <div class="flex flex-row justify-between items-center w-full pt-5 pr-5 space-x-4">
      <ChevronLeftIcon @click="goBack" class="w-6 h-6 cursor-pointer" />
      <div class="text-2xl font-bold">{{ walletName }} Wallet</div>
      <div>/</div>
      <div class="text-2xl font-bold grow">Add Funds</div>
      <XMarkIcon @click="closeWalletOverlay" class="w-6 h-6 cursor-pointer" />
    </div>
    <img :src="qrCode" alt="QR Code" />
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import QRCode from 'qrcode';
import { useAccountStore } from '../../stores/account';
import { ChevronLeftIcon, XMarkIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  walletId: {
    type: String as Vue.PropType<'mng' | 'llb' | 'vlt'>,
    required: true
  }
});

const emit = defineEmits(['navigate']);

const goBack = () => {
  emit('navigate', { screen: 'main' });
}

const accountStore = useAccountStore();

const qrCode = Vue.ref('');

const walletName = Vue.computed(() => {
  if (props.walletId === 'mng') {
    return 'Mining';
  } else if (props.walletId === 'llb') {
    return 'Liquid Locking';
  } else if (props.walletId === 'vlt') {
    return 'Vaulting';
  }
});

async function loadQRCode() {
  qrCode.value = await QRCode.toDataURL(accountStore.seedAddress);
}

function closeWalletOverlay() {
  emit('navigate', { close: true });
}

Vue.onMounted(() => {
  loadQRCode();
});
</script>