<template>
  <TransitionRoot class='absolute inset-0 z-10' :show="isOpen">
    <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
      <BgOverlay @close="closeOverlay" />
    </TransitionChild>

    <div class="absolute inset-0 z-100 overflow-y-auto pt-[1px] flex items-center justify-center pointer-events-none">
      <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" enter-to="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200" leave-from="opacity-100 translate-y-0 sm:scale-100" leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
        <div class="bg-white border border-black/40 p-2 rounded-lg pointer-events-auto shadow-xl relative w-8/12 max-h-9/12 overflow-scroll">
          <Send v-if="activeScreen === 'send'" @navigate="navigate" :walletId="walletId" />
          <Receive v-else-if="activeScreen === 'receive'" @navigate="navigate" :walletId="walletId" />
          <div v-else>
            <div class="flex flex-row justify-between items-center w-full px-3 py-3 space-x-4 text-5xl font-bold border-b border-black/20">
              <h2 class="text-2xl font-bold">{{walletName}} Wallet</h2>
              <CopyToClipboard :content="wallet.address" class="relative text-2xl font-normal grow cursor-pointer">
                <span class="opacity-50">{{abreviateAddress(wallet.address)}} <CopyIcon class="w-5 h-5 ml-1 inline-block" /></span>
                <template #copied>
                  <div class="absolute top-0 left-0 w-full h-full pointer-events-none">
                    {{abreviateAddress(wallet.address)}} <CopyIcon class="w-5 h-5 ml-1 inline-block" />
                  </div>
                </template>
              </CopyToClipboard>
              <div @click="closeOverlay" class="mr-1 z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/60 hover:bg-[#f1f3f7]">
                <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
              </div>
            </div>
            <div class="w-full text-center py-14 text-5xl font-bold border-b border-black/20">
              {{currencySymbol}}{{ fmtCommas(argonTo(wallet.totalValue).toFixed()).split('.')[0] }}<span class="opacity-50">.{{ wallet.totalValue.toFixed(2).split('.')[1] }}</span>
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
import { useConfigStore } from '../stores/config';
import { fmtCommas, abreviateAddress } from '../lib/Utils';
import { storeToRefs } from 'pinia';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import Tokens from './wallet-overlay/Tokens.vue';
import Activity from './wallet-overlay/Activity.vue';
import Receive from './wallet-overlay/Receive.vue';
import Send from './wallet-overlay/Send.vue';
import BgOverlay from '../components/BgOverlay.vue';
import CopyIcon from '../assets/copy.svg';
import CopyToClipboard from '../components/CopyToClipboard.vue';

const configStore = useConfigStore();
const { argonTo } = configStore;
const { currencySymbol } = storeToRefs(configStore);

const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);

const walletId: Vue.Ref<'mng' | 'llb' | 'vlt'> = Vue.ref('mng');
const walletName = Vue.ref('');
const wallet = Vue.ref({
  address: '',
  argons: 0,
  argonots: 0,
  totalValue: 0,
});

Vue.watch(walletId, () => {
  if (walletId.value === 'mng') {
    walletName.value = 'Mining';
    wallet.value = configStore.mngWallet;
  } else if (walletId.value === 'llb') {
    walletName.value = 'Liquid Locking';
    wallet.value = configStore.llbWallet;
  } else if (walletId.value === 'vlt') {
    walletName.value = 'Vaulting';
    wallet.value = configStore.vltWallet;
  }
}, { immediate: true });

const activeScreen = Vue.ref('main');
const activeTab = Vue.ref('tokens');

function navigate($event: any) {
  if ($event.close) {
    closeOverlay();
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

function closeOverlay() {
  isOpen.value = false;
  isLoaded.value = false;
};
</script>