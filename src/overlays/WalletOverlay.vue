<template>
  <TransitionRoot class='absolute inset-0' :show="isOpen">
    <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
      <BgOverlay />
    </TransitionChild>

    <div class="absolute inset-0 z-100 overflow-y-auto pt-[1px] flex items-center justify-center pointer-events-none">
      <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" enter-to="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200" leave-from="opacity-100 translate-y-0 sm:scale-100" leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
        <div class="bg-white border border-black/40 p-4 rounded-lg pointer-events-auto shadow-xl relative w-8/12 h-9/12 overflow-scroll">
          <Send v-if="activeScreen === 'send'" @navigate="navigate" />
          <Receive v-else-if="activeScreen === 'receive'" @navigate="navigate" />
          <div v-else>
            <div class="flex flex-row justify-between items-center w-full text-center pt-5 pr-5 space-x-4 text-5xl font-bold">
              <h2 class="text-2xl font-bold">substrate {{accountStore.address}}</h2>
              <XMarkIcon @click="closeWalletOverlay" class="w-6 h-6 cursor-pointer" />
            </div>
            <div class="w-full text-center pt-5 text-5xl font-bold border-b border-black/50 pb-5">
              {{currencySymbol}}{{addCommas(argonTo(accountStore.walletBalance), 2)}}
            </div>
            <div class="flex flex-row justify-between items-center w-full text-center pt-5 pr-5 space-x-4 font-bold">
              <ul class="flex flex-row space-x-4 grow">
                <li @click="navigate({ tab: 'tokens' })">Tokens</li>
                <li @click="navigate({ tab: 'activity' })">Activity</li>
              </ul>
              <ul class="flex flex-row space-x-4">
                <li @click="navigate({ screen: 'receive' })">Fund Your Wallet</li>
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
import { addCommas } from '../lib/Utils';
import { storeToRefs } from 'pinia';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import Tokens from './WalletOverlay/Tokens.vue';
import Activity from './WalletOverlay/Activity.vue';
import Receive from './WalletOverlay/Receive.vue';
import Send from './WalletOverlay/Send.vue';
import BgOverlay from '../components/BgOverlay.vue';

const accountStore = useAccountStore();
const { argonTo, argonotTo } = accountStore;
const { currencySymbol, argonBalance, argonotBalance } = storeToRefs(accountStore);

const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);

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