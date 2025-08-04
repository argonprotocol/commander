<!-- prettier-ignore -->
<template>
  <DialogRoot :open="isOpen">
    <DialogPortal>
      <AnimatePresence>
        <DialogOverlay asChild>
          <Motion asChild :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0 }">
            <BgOverlay @close="closeOverlay" />
          </Motion>
        </DialogOverlay>
        
        <DialogContent asChild @escapeKeyDown="handleEscapeKeyDown" :aria-describedby="undefined">    
          <Motion asChild :initial="{ opacity: 0, top: '40%' }" :animate="{ opacity: 1, top: '50%' }" :exit="{ opacity: 0, top: '0' }">
            <div class="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 z-50 bg-white border border-black/40 p-2 rounded-lg pointer-events-auto shadow-xl w-9/12 overflow-scroll">
              <Receive v-if="activeScreen === 'receive'" @navigate="navigate" :walletId="walletId" />               
              <div v-else>
                <div class="flex flex-row justify-between items-center w-full px-3 py-3 space-x-4 text-5xl font-bold border-b border-black/20">
                  <DialogTitle class="text-2xl font-bold">{{ walletName }} Resources</DialogTitle>
                  <CopyToClipboard :content="wallet.address" class="relative text-2xl font-normal grow cursor-pointer">
                    <span class="opacity-50">
                      {{ abreviateAddress(wallet.address) }}
                      <CopyIcon class="w-5 h-5 ml-1 inline-block" />
                    </span>
                    <template #copied>
                      <div class="absolute top-0 left-0 w-full h-full pointer-events-none">
                        {{ abreviateAddress(wallet.address) }}
                        <CopyIcon class="w-5 h-5 ml-1 inline-block" />
                      </div>
                    </template>
                  </CopyToClipboard>
                  <div
                    @click="closeOverlay"
                    class="mr-1 z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/60 hover:bg-[#f1f3f7]"
                  >
                    <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
                  </div>
                </div>
                <div class="w-full flex flex-col items-center py-10 border-b border-black/20">
                  <div class="w-full text-center text-5xl font-bold">
                    <span>{{ currency.symbol }}{{ microgonToMoneyNm(totalValue).format('0,0.00').split('.')[0] }}</span>
                    <span class="opacity-50">.{{ microgonToMoneyNm(totalValue).format('0.00').split('.')[1] }}</span>
                  </div>
                  <div class="w-full text-center pt-2">Total Value of {{ walletName }} Resources</div>
                </div>
                <div class="flex flex-row justify-between items-center w-full text-center px-3 space-x-4 font-bold">
                  <ul class="flex flex-row space-x-6 grow mt-3">
                    <li @click="navigate({ tab: 'tokens' })" :class="[activeTab === 'tokens' ? 'border-argon-500' : 'border-transparent']" class="border-b-2 cursor-pointer pb-2">Balance Sheet</li>
                    <li @click="navigate({ tab: 'activity' })" :class="[activeTab === 'activity' ? 'border-argon-500' : 'border-transparent']" class="border-b-2 cursor-pointer pb-2">Transactions</li>
                  </ul>
                  <ul class="flex flex-row">
                    <li @click="navigate({ screen: 'receive' })" class="cursor-pointer border border-argon-500 rounded-md px-2">Receive Funds</li>
                  </ul>
                </div>

                <Resources :class="[activeTab === 'tokens' ? 'visible' : 'invisible']" :walletId="walletId" @navigate="navigate" />
                <Activity :class="[activeTab === 'activity' ? 'visible' : 'invisible']" :walletId="walletId" />
              </div>
            </div>
          </Motion>
        </DialogContent>
      </AnimatePresence>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import { AnimatePresence, Motion } from 'motion-v';
import basicEmitter from '../emitters/basicEmitter';
import { useCurrency } from '../stores/currency';
import { useWallets } from '../stores/wallets';
import { abreviateAddress } from '../lib/Utils';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import Resources from './wallet-overlay/Resources.vue';
import Activity from './wallet-overlay/Activity.vue';
import Receive from './wallet-overlay/Receive.vue';
import BgOverlay from '../components/BgOverlay.vue';
import CopyIcon from '../assets/copy.svg?component';
import CopyToClipboard from '../components/CopyToClipboard.vue';
import { createNumeralHelpers } from '../lib/numeral';

const currency = useCurrency();
const wallets = useWallets();

const { microgonToMoneyNm } = createNumeralHelpers(currency);

const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);

const walletId: Vue.Ref<'mining' | 'vaulting'> = Vue.ref('mining');
const walletName = Vue.ref('');
const wallet = Vue.ref({
  address: '',
  availableMicrogons: 0n,
  availableMicronots: 0n,
  reservedMicronots: 0n,
});

Vue.watch(
  walletId,
  () => {
    if (walletId.value === 'mining') {
      walletName.value = 'Mining';
      wallet.value = wallets.miningWallet;
    } else if (walletId.value === 'vaulting') {
      walletName.value = 'Vaulting';
      wallet.value = wallets.vaultingWallet;
    }
  },
  { immediate: true },
);

const activeScreen = Vue.ref('main');
const activeTab = Vue.ref('tokens');

const totalValue = Vue.computed(() => {
  if (walletId.value === 'mining') {
    return wallets.totalMiningResources;
  } else if (walletId.value === 'vaulting') {
    return wallets.totalVaultingResources;
  }
  return 0n;
});

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

basicEmitter.on('openWalletOverlay', async (data: any) => {
  walletId.value = data.walletId;
  isOpen.value = true;
  isLoaded.value = true;
  activeScreen.value = data.screen || 'main';
  activeTab.value = data.tab || 'tokens';
});

function closeOverlay() {
  isOpen.value = false;
  isLoaded.value = false;
}

function handleEscapeKeyDown() {
  closeOverlay();
}
</script>
