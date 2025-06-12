<template>
  <div class="grow relative bg-white rounded border border-[#CCCEDA] shadow text-center m-3 overflow-hidden">
    <div class="relative mx-auto inline-block w-6/10">
      <h1 class="text-4xl font-bold text-gray-600 text-center mt-32 mb-1 whitespace-nowrap border-t border-gray-300 pt-10">YOUR BIDDING BOT</h1>

      <div class="flex flex-col items-center justify-center min-h-[75px]">
        <div class="text-6xl text-center text-gray-600 font-bold">
          FAILED TO WIN A BID
        </div>
      </div>
      <p class="text-center text-lg mt-6 border-t border-b border-gray-300 pt-8 pb-7 font-light leading-7.5 inline-block">
        The current auction has climbed above the Maximum Price you set in your budget. This means your bot can no longer bid.
        Modify your Bidding Rules if you wish to resume.
      </p>
      <div class="flex flex-row justify-center items-center space-x-6">
        <ActiveBidsOverlayButton />
        <ActiveBidsActivityOverlayButton />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { useConfig } from '../../stores/config';
import { useBlockchainStore, type IActiveBid } from '../../stores/blockchain';
import ActiveBidsOverlayButton from '../../overlays/ActiveBidsOverlayButton.vue';
import ActiveBidsActivityOverlayButton from '../../overlays/ActiveBidsActivityOverlayButton.vue';

dayjs.extend(utc);

const config = useConfig();
const blockchainStore = useBlockchainStore();

function openBiddingBudgetOverlay() {
  // emitter.emit('openWalletOverlay', { walletId: 'mng', screen: 'receive' });
}

Vue.onMounted(async () => {
  if (!config.biddingRules) return;
});
</script>

<style scoped>
@reference "../../main.css";

table {
  thead th {
    @apply pb-2;
  }
  td {
    @apply border-t border-gray-300 align-middle;
    &:first-child {
      @apply opacity-50;
    }
  }
}
</style>
