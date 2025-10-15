<!-- prettier-ignore -->
<template>
  <div class="grow relative bg-white rounded border border-[#CCCEDA] shadow text-center m-3">
    <div class="relative mx-auto inline-block w-6/10">
      <div class="text-5xl font-bold text-gray-600 text-center mt-32 mb-4 whitespace-nowrap border-t border-gray-300 pt-16">
        YOUR BIDDING BOT
      </div>
      <div class="flex flex-col items-center justify-center min-h-[75px]">
        <div class="text-7xl text-center text-gray-600 font-bold whitespace-nowrap">FAILED TO WIN A BID</div>
      </div>
      <p class="text-center text-lg mt-10 border-t border-b border-gray-300 pt-8 pb-7 font-light leading-7.5 inline-block">
        The current auction has climbed above the Maximum Price set in your budget. This means your bot can no longer
        bid.
        <span @click="openBiddingBudgetOverlay" class="text-argon-600 underline cursor-pointer underline-offset-2">
          Modify your Bidding Rules
        </span>
        if you wish to resume.
      </p>
      <div class="flex flex-row justify-center items-center space-x-6 mt-14">
        <ActiveBidsOverlayButton />
        <BotHistoryOverlayButton />
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
import BotHistoryOverlayButton from '../../overlays/BotHistoryOverlayButton.vue';
import basicEmitter from '../../emitters/basicEmitter';

dayjs.extend(utc);

const config = useConfig();
const blockchainStore = useBlockchainStore();

function openBiddingBudgetOverlay() {
  basicEmitter.emit('openBotCreateOverlay');
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
