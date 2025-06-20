<template>
  <div class="grow relative bg-white rounded border border-[#CCCEDA] shadow text-center m-3 overflow-hidden">
    <ConfettiIcon class="absolute top-[10px] left-[10px]" style="width: calc(100% - 20px)" />
    <div class="relative mx-auto inline-block w-6/10">
      <h1 class="text-6xl font-bold text-argon-600 text-center mt-32 mb-10 whitespace-nowrap">YOUR BIDDING BOT</h1>

      <div class="text-center mt-6 mb-5 uppercase text-base flex flex-row justify-center items-center">
        <div class="h-[1px] bg-gray-300 w-1/2"></div>
        <div class="whitespace-nowrap px-5 text-gray-500">IS SUBMITTING ITS</div>
        <div class="h-[1px] bg-gray-300 w-1/2"></div>
      </div>
      <div class="flex flex-col items-center justify-center min-h-[75px] fade-in-out">
        <div class="text-6xl text-center text-argon-600 font-bold">FIRST-EVER MINING BID</div>
      </div>
      <p
        class="text-center text-lg mt-6 border-t border-b border-gray-300 pt-8 pb-7 font-light leading-7.5 inline-block"
      >
        Your bidding bot has successfully connected. It's now trying to win
        {{ maxSeatCount }} mining seat{{ maxSeatCount === 1 ? '' : 's' }} with a
        <span @click="openBiddingBudgetOverlay" class="text-argon-600 underline cursor-pointer underline-offset-2">
          budget cap of {{ currencySymbol }}{{ fmtMoney(currencyStore.argonTo(maxBidPerSeat)) }} per seat
        </span>
        .
        <template v-if="auctionIsClosing && startOfAuctionClosing">
          The currently active auction is in the process of closing. Bids can still be submitted for the next
          <div class="font-bold py-2">
            <CountdownClock
              :time="startOfAuctionClosing"
              @tick="handleAuctionClosingTick"
              v-slot="{ hours, minutes, seconds }"
            >
              <template v-if="hours">{{ hours }} hour{{ hours > 1 ? 's' : '' }},</template>
              <template v-if="minutes">{{ minutes }} minute{{ minutes > 1 ? 's' : '' }} and</template>
              {{ seconds }} second{{ seconds > 1 ? 's' : '' }}
            </CountdownClock>
          </div>
        </template>
        <template v-else-if="startOfNextCohort">
          The current auction will begin closing in
          <div class="font-bold py-2">
            <CountdownClock :time="startOfNextCohort" v-slot="{ hours, minutes, seconds }">
              <template v-if="hours">{{ hours }} hour{{ hours > 1 ? 's' : '' }},</template>
              <template v-if="minutes">{{ minutes }} minute{{ minutes > 1 ? 's' : '' }} and</template>
              {{ seconds }} second{{ seconds > 1 ? 's' : '' }}
            </CountdownClock>
          </div>
        </template>
        This page will update automatically when a successful bid is confirmed.
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
import { fmtMoney } from '../../lib/Utils';
import CountdownClock from '../../components/CountdownClock.vue';
import ConfettiIcon from '../../assets/confetti.svg?component';
import ActiveBidsOverlayButton from '../../overlays/ActiveBidsOverlayButton.vue';
import ActiveBidsActivityOverlayButton from '../../overlays/ActiveBidsActivityOverlayButton.vue';
import { IBiddingRules, BiddingParamsHelper } from '@argonprotocol/commander-calculator';
import emitter from '../../emitters/basic';
import { getMainchain } from '../../stores/mainchain';
import { useCurrencyStore } from '../../stores/currency';
import { useStats } from '../../stores/stats';
import { storeToRefs } from 'pinia';

dayjs.extend(utc);

const mainchain = getMainchain();
const stats = useStats();
const config = useConfig();
const currencyStore = useCurrencyStore();
const { currencySymbol } = storeToRefs(currencyStore);

const auctionIsClosing = Vue.ref(false);
const startOfAuctionClosing: Vue.Ref<dayjs.Dayjs | null> = Vue.ref(null);
const startOfNextCohort: Vue.Ref<dayjs.Dayjs | null> = Vue.ref(null);
const maxSeatCount = Vue.ref(0);

const biddingParamsHelper = new BiddingParamsHelper(config.biddingRules as IBiddingRules, mainchain);

const maxBidPerSeat = Vue.computed(() => config.biddingRules?.finalAmount || 0);

function handleAuctionClosingTick(totalSecondsRemaining: number) {
  if (totalSecondsRemaining <= 0) {
    auctionIsClosing.value = true;
  }
}

function openBiddingBudgetOverlay() {
  emitter.emit('openBiddingRulesOverlay');
}

Vue.onMounted(async () => {
  if (!config.biddingRules) return;

  maxSeatCount.value = await biddingParamsHelper.getMaxSeats();

  if (!startOfAuctionClosing.value || !startOfNextCohort.value) {
    const tickAtStartOfAuctionClosing = await mainchain.getTickAtStartOfAuctionClosing();
    const tickAtStartOfNextCohort = await mainchain.getTickAtStartOfNextCohort();
    startOfAuctionClosing.value = dayjs.utc(Number(tickAtStartOfAuctionClosing) * 60 * 1000);
    startOfNextCohort.value = dayjs.utc(Number(tickAtStartOfNextCohort) * 60 * 1000);
  }
});
</script>

<style scoped>
.fade-in-out {
  animation: fadeInOut 1.5s ease-in-out infinite;
  animation-delay: 0s;
}

@keyframes fadeInOut {
  0% {
    opacity: 0.1;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.1;
  }
}
</style>

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
