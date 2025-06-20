<template>
  <div class="grow relative bg-white rounded border border-[#CCCEDA] shadow text-center m-3 overflow-hidden">
    <ConfettiIcon class="absolute top-[10px] left-[10px]" style="width: calc(100% - 20px)" />
    <div class="relative mx-auto inline-block">
      <h1 class="text-5xl font-bold text-center mt-24 mb-10 whitespace-nowrap relative z-0">
        <span FadeBgToWhite class="relative text-argon-600 z-20">Your First Auction Is Live!</span>
      </h1>

      <div class="text-center mb-5 uppercase text-base flex flex-row justify-center items-center">
        <div class="h-[1px] bg-gray-300 w-1/2"></div>
        <div class="whitespace-nowrap px-5 text-gray-500">
          YOU ARE IN BID POSITION{{ seatPositions.length > 1 ? 'S' : '' }}
        </div>
        <div class="h-[1px] bg-gray-300 w-1/2"></div>
      </div>
      <div class="flex flex-col items-center justify-center min-h-[75px] fade-in-out">
        <div v-if="seatPositions.length" :class="[priceTextSize, 'text-center text-argon-600 font-bold']">
          {{
            seatPositions.slice(0, -1).join(', ') +
            (seatPositions.length > 1 ? ' & ' : '') +
            seatPositions[seatPositions.length - 1]
          }}
        </div>
        <div v-else class="text-center text-7xl text-argon-600 font-bold">--- --- --- ---</div>
      </div>
      <div class="text-center mt-6 mb-5 uppercase text-base flex flex-row justify-center items-center">
        <div class="h-[1px] bg-gray-300 w-1/2"></div>
        <div class="whitespace-nowrap px-5 text-gray-500">
          AT A {{ seatPositions.length ? 'COMBINED' : 'TOTAL' }} PRICE OF
        </div>
        <div class="h-[1px] bg-gray-300 w-1/2"></div>
      </div>
      <div class="flex flex-col items-center justify-center min-h-[75px] fade-in-out">
        <div v-if="seatPositions.length" :class="[priceTextSize, 'text-center text-argon-600 font-bold']">
          {{ currencySymbol }}{{ fmtMoney(currencyStore.argonTo(currentBidPrice)) }}
        </div>
        <div v-else class="text-center text-7xl text-argon-600 font-bold">{{ currencySymbol }}--.--</div>
      </div>
      <p class="text-center text-lg mt-6 border-t border-b border-gray-300 pt-8 pb-7 font-light leading-7.5">
        <template v-if="auctionIsClosing && startOfAuctionClosing != null">
          This auction is in the process of closing. Bids can still be submitted for the
          <br />
          next
          <CountdownClock
            :time="startOfAuctionClosing"
            @tick="handleAuctionClosingTick"
            v-slot="{ hours, minutes, seconds }"
          >
            <template v-if="hours">{{ hours }} hour{{ hours > 1 ? 's' : '' }},</template>
            <template v-if="minutes">{{ minutes }} minute{{ minutes > 1 ? 's' : '' }} and</template>
            {{ seconds }} second{{ seconds > 1 ? 's' : '' }}
          </CountdownClock>
        </template>
        <template v-else-if="startOfNextCohort != null">
          This auction will begin closing in
          <CountdownClock :time="startOfNextCohort" v-slot="{ hours, minutes, seconds }">
            <template v-if="hours">{{ hours }} hour{{ hours > 1 ? 's' : '' }},</template>
            <template v-if="minutes">{{ minutes }} minute{{ minutes > 1 ? 's' : '' }} and</template>
            {{ seconds }} second{{ seconds > 1 ? 's' : '' }}
          </CountdownClock>
          .
          <br />
          Your account allows for a total bidding budget of of {{ currencySymbol
          }}{{ fmtMoney(currencyStore.argonTo(totalBiddingBudget)) }} if needed.
        </template>
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
import { useCurrencyStore } from '../../stores/currency';
import { storeToRefs } from 'pinia';
import { IBiddingRules, BiddingParamsHelper } from '@argonprotocol/commander-calculator';
import { IWinningBid } from '@argonprotocol/commander-bot/src/storage';
import { fmtMoney } from '../../lib/Utils';
import CountdownClock from '../../components/CountdownClock.vue';
import ConfettiIcon from '../../assets/confetti.svg?component';
import ActiveBidsOverlayButton from '../../overlays/ActiveBidsOverlayButton.vue';
import ActiveBidsActivityOverlayButton from '../../overlays/ActiveBidsActivityOverlayButton.vue';
import { getMainchain } from '../../stores/mainchain';
import { useStats } from '../../stores/stats';

dayjs.extend(utc);

const mainchain = getMainchain();

const stats = useStats();
const config = useConfig();

const currencyStore = useCurrencyStore();
const { currencySymbol } = storeToRefs(currencyStore);

const auctionIsClosing = Vue.ref(false);

const totalBiddingBudget = Vue.ref(0);

const currentBidPrice = Vue.computed(() => {
  const myBids = stats.winningBids.filter((bid: IWinningBid) => bid.subAccountIndex !== undefined);
  const total = myBids.reduce((acc: bigint, bid: IWinningBid) => acc + (bid.argonsBid ?? 0n), 0n);
  return Number(total / 10_000n) / 100;
});

const seatPositions = Vue.computed(() => {
  const myBids = stats.winningBids.filter((bid: IWinningBid) => bid.subAccountIndex !== undefined);
  return myBids.map((bid: IWinningBid) => (bid.bidPosition ?? 0) + 1);
});

const priceTextSize = Vue.computed(() => {
  return seatPositions.value.length > 8 ? 'text-6xl' : 'text-7xl';
});

const biddingParamsHelper = new BiddingParamsHelper(config.biddingRules as IBiddingRules, getMainchain());
const startOfAuctionClosing: Vue.Ref<dayjs.Dayjs | null> = Vue.ref(null);
const startOfNextCohort: Vue.Ref<dayjs.Dayjs | null> = Vue.ref(null);

function handleAuctionClosingTick(totalSecondsRemaining: number) {
  if (totalSecondsRemaining <= 0) {
    auctionIsClosing.value = true;
  }
}

Vue.onMounted(async () => {
  if (!config.biddingRules) return;

  if (!startOfAuctionClosing.value || !startOfNextCohort.value) {
    const tickAtStartOfAuctionClosing = await mainchain.getTickAtStartOfAuctionClosing();
    const tickAtStartOfNextCohort = await mainchain.getTickAtStartOfNextCohort();
    startOfAuctionClosing.value = dayjs.utc(Number(tickAtStartOfAuctionClosing) * 60 * 1000);
    startOfNextCohort.value = dayjs.utc(Number(tickAtStartOfNextCohort) * 60 * 1000);
  }

  const seatCount = await biddingParamsHelper.getMaxSeats();
  totalBiddingBudget.value = config.biddingRules.finalAmount * seatCount;
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

[FadeBgToWhite] {
  @apply relative bg-white;
  &:before {
    @apply absolute top-0 left-0 right-0 h-full z-[-1] -translate-y-full bg-gradient-to-b from-transparent to-white;
    content: '';
  }
}
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
