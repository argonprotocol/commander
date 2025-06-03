<template>
  <div v-if="isDataSyncing" class="flex flex-row items-center gap-x-3 cursor-pointer bg-argon-500 hover:bg-argon-600 text-white px-3.5 py-2 border-b border-argon-700" style="box-shadow: inset 0 2px 2px rgba(0, 0, 0, 0.1)">
    <AlertIcon class="w-4 h-4 text-white relative left-1 inline-block" />
    <div v-if="configStore.dataSync.type === 'server'" class="font-bold grow">Your server data is being synced </div>
    <div v-else-if="configStore.dataSync.type === 'db'" class="font-bold grow">Updating your stats database </div>
    <div>{{ configStore.dataSync.progress.toFixed(0) }}%</div>
  </div>
  <div InsufficientFunds v-else-if="hasInsufficientFunds" @click="openFundMiningWalletOverlay" class="group flex flex-row items-center gap-x-3 cursor-pointer bg-argon-error hover:bg-argon-error-darker text-white px-3.5 py-2 border-b border-argon-error-darkest" style="box-shadow: inset 0 2px 2px rgba(0, 0, 0, 0.1)">
    <AlertIcon class="w-4 h-4 text-white relative left-1 inline-block" />
    <div class="font-bold grow">BIDDING DISABLED. Your wallet no longer has enough funds to continue bidding.</div>
    <span class="cursor-pointer font-bold inline-block rounded-full bg-argon-error-darkest/60 group-hover:bg-argon-error-darkest hover:bg-black/80 px-3">
      Add Funds
    </span>
  </div>
  <div MaxBudgetTooLow v-else-if="maxBudgetIsTooLow" @click="openBiddingRulesOverlay" class="group flex flex-row items-center gap-x-3 cursor-pointer bg-argon-error hover:bg-argon-error-darker text-white px-3.5 py-2 border-b border-argon-error-darkest" style="box-shadow: inset 0 2px 2px rgba(0, 0, 0, 0.1)">
    <AlertIcon class="w-4 h-4 text-white relative left-1 inline-block" />
    <div class="font-bold grow">BIDDING DISABLED. Your bot has stopped submitting bids because your budget has been reached.</div>
    <span class="cursor-pointer font-bold inline-block rounded-full bg-argon-error-darkest/60 group-hover:bg-argon-error-darkest hover:bg-black/80 px-3">
      Open Bidding Rules
    </span>
  </div>
  <div MaxBidTooLow v-else-if="maxBidIsTooLow" @click="openBiddingRulesOverlay" class="group flex flex-row items-center gap-x-3 cursor-pointer bg-argon-error hover:bg-argon-error-darker text-white px-3.5 py-2 border-b border-argon-error-darkest" style="box-shadow: inset 0 2px 2px rgba(0, 0, 0, 0.1)">
    <AlertIcon class="w-4 h-4 text-white relative left-1 inline-block" />
    <div class="font-bold grow">BIDDING DISABLED.  The auction's lowest price has climbed above your Maximum Price.</div>
    <span class="cursor-pointer font-bold inline-block rounded-full bg-argon-error-darkest/60 group-hover:bg-argon-error-darkest hover:bg-black/80 px-3">
      Open Bidding Rules
    </span>
  </div>
  <div LowFunds v-else-if="hasLowFunds" @click="openFundMiningWalletOverlay" class="flex flex-row items-center gap-x-3 cursor-pointer bg-argon-500 hover:bg-argon-600 text-white px-3.5 py-2 border-b border-argon-700" style="box-shadow: inset 0 2px 2px rgba(0, 0, 0, 0.1)">
    <AlertIcon class="w-4 h-4 text-white relative left-1 inline-block" />
    <div class="font-bold grow">WARNING. Your mining wallet is low on funds which may inhibit bidding.</div>
    <span class="cursor-pointer font-bold inline-block rounded-full bg-argon-700 hover:bg-black/90 px-3">
      Add Funds
    </span>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { storeToRefs } from 'pinia';
import { useConfigStore } from '../stores/config';
import AlertIcon from '../assets/alert.svg';
import emitter from '../emitters/basic';

const configStore = useConfigStore();
const { isDataSyncing } = storeToRefs(configStore);

const hasLowFunds = Vue.computed(() => {
  if (!configStore.biddingRules) {
    return false;
  }
  
  if (configStore.mngWallet.argons < configStore.biddingRules.requiredArgons) {
    return true;
  } 
  
  if (configStore.mngWallet.argonots < configStore.biddingRules.requiredArgonots) {
    return true;
  }

  return false;
});

const hasInsufficientFunds = Vue.computed(() => {
  // if server has thrown an insufficient funds error
  return false;
});

const maxBudgetIsTooLow = Vue.computed(() => {
  // if server has thrown a MaxBudgetTooLow error
  return false;
});

const maxBidIsTooLow = Vue.computed(() => {
  // if server has thrown a MaxBidTooLow error
  return false;
});

function openFundMiningWalletOverlay() {
  emitter.emit('openWalletOverlay', { walletId: 'mng', screen: 'receive' });
}

function openBiddingRulesOverlay() {
  emitter.emit('openBiddingRulesOverlay');
}

</script>