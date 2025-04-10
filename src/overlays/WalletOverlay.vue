<template>
  <TransitionRoot class='absolute inset-0' :show="isOpen">
    <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
      <BgOverlay />
    </TransitionChild>

    <div class="absolute inset-0 z-100 overflow-y-auto pt-[1px] flex items-center justify-center pointer-events-none">
      <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" enter-to="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200" leave-from="opacity-100 translate-y-0 sm:scale-100" leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
        <div class="bg-white border border-black/40 p-2 rounded-lg pointer-events-auto shadow-xl relative w-8/12 h-9/12 overflow-scroll">
          <Send v-if="activeScreen === 'send'" @navigate="navigate" :walletId="walletId" />
          <Receive v-else-if="activeScreen === 'receive'" @navigate="navigate" :walletId="walletId" />
          <div v-else>
            <div class="flex flex-row justify-between items-center w-full text-center px-3 space-x-4 text-5xl font-bold border-b border-black/20 pb-2">
              <h2 class="text-2xl font-bold">{{walletName}} Wallet</h2>
              <div class="text-2xl font-normal opacity-50">{{abreviateAddress(walletAddress)}} <CopyIcon class="w-5 h-5 ml-1 inline-block" /></div>
              <div class="grow text-right">
                <XMarkIcon @click="closeWalletOverlay" class="w-6 h-6 cursor-pointer inline-block" />
              </div>
            </div>
            <div class="w-full text-center py-14 text-5xl font-bold border-b border-black/50">
              {{currencySymbol}}{{addCommas(argonTo(accountStore.walletBalance), 2)}}
            </div>
            <div class="flex flex-row justify-between items-center w-full text-center pt-5 pb-2 px-3 space-x-4 font-bold">
              <ul class="flex flex-row space-x-4 grow">
                <li @click="navigate({ tab: 'tokens' })" class="cursor-pointer">Tokens</li>
                <li @click="navigate({ tab: 'activity' })" class="cursor-pointer">Activity</li>
              </ul>
              <ul class="flex flex-row">
                <li @click="navigate({ screen: 'receive' })" class="cursor-pointer">Add Funds</li>
              </ul>
            </div>
            
            <Tokens v-if="activeTab === 'tokens'" @navigate="navigate" />
            <Activity v-else-if="activeTab === 'activity'" />
          </div>
        </div>
      </TransitionChild>
    </div>
  </TransitionRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { TransitionChild, TransitionRoot } from '@headlessui/vue';
import emitter from '../emitters/basic';
import { useAccountStore } from '../stores/account';
import { addCommas, abreviateAddress } from '../lib/Utils';
import { storeToRefs } from 'pinia';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import Tokens from './WalletOverlay/Tokens.vue';
import Activity from './WalletOverlay/Activity.vue';
import Receive from './WalletOverlay/Receive.vue';
import Send from './WalletOverlay/Send.vue';
import BgOverlay from '../components/BgOverlay.vue';
import CopyIcon from '../assets/copy.svg';

const accountStore = useAccountStore();
const { argonTo } = accountStore;
const { currencySymbol } = storeToRefs(accountStore);

const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);

const walletId: Vue.Ref<'mng' | 'llb' | 'vlt'> = Vue.ref('mng');
const walletName = Vue.ref('');
const walletAddress = Vue.ref('');

Vue.watch(walletId, () => {
  if (walletId.value === 'mng') {
    walletName.value = 'Mining';
    walletAddress.value = accountStore.mngAddress;
  } else if (walletId.value === 'llb') {
    walletName.value = 'Liquid Locking';
    walletAddress.value = accountStore.llbAddress;
  } else if (walletId.value === 'vlt') {
    walletName.value = 'Vaulting';
    walletAddress.value = accountStore.vltAddress;
  }
});

const activeScreen = Vue.ref('main');
const activeTab = Vue.ref('tokens');

function navigate($event: any) {
  if ($event.close) {
    closeWalletOverlay();
    return;
  }
  if ($event.tab) {
    activeTab.value = $event.tab;
  }
  if ($event.screen) {
    activeScreen.value = $event.screen;
  }
}

emitter.on('openWalletOverlay', async (data: any) => {
  walletId.value = data.walletId;
  isOpen.value = true;
  isLoaded.value = true;
  activeScreen.value = data.screen || 'main';
  activeTab.value = data.tab || 'tokens';
});

const closeWalletOverlay = () => {
  isOpen.value = false;
  isLoaded.value = false;
};
</script>