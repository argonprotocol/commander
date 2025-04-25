<template>
  <div class="flex flex-col h-full w-full p-3">
    <div class="grow relative bg-white rounded border border-[#CCCEDA] shadow text-center overflow-hidden">
      <img src="../../assets/confetti.svg" class="absolute top-[10px] left-[10px]" style="width: calc(100% - 20px);" />
      <div class="relative mx-auto inline-block">
        <h1 class="text-4xl font-bold text-center mt-40 mb-10 whitespace-nowrap">Your First Auction Is Underway!</h1>
        
        <div class="text-center mt-6 mb-5 uppercase text-base flex flex-row justify-center items-center">
          <div class="h-[1px] bg-gray-300 w-1/2"></div>
          <div class="whitespace-nowrap px-5 text-gray-500">YOU ARE IN BID POSITION{{ seatPositions.length > 1 ? 'S' : '' }}</div>
          <div class="h-[1px] bg-gray-300 w-1/2"></div>
        </div>
        <div v-if="seatPositions.length" class="text-center text-7xl font-bold">
          {{ seatPositions.slice(0, -1).join(', ') + (seatPositions.length > 1 ? ' & ' : '') + seatPositions[seatPositions.length-1] }}
        </div>
        <div v-else class="text-center text-7xl text-argon-600 font-bold fade-in-out">
          PENDING
        </div>
        <div class="text-center mt-6 mb-5 uppercase text-base flex flex-row justify-center items-center">
          <div class="h-[1px] bg-gray-300 w-1/2"></div>
          <div class="whitespace-nowrap px-5 text-gray-500">AT A {{ seatPositions.length ? 'COMBINED' : 'TOTAL' }} BID PRICE OF</div>
          <div class="h-[1px] bg-gray-300 w-1/2"></div>
        </div>
        <div class="text-center text-7xl text-argon-600 font-bold fade-in-out">
          {{configStore.currencySymbol}}{{ addCommas(configStore.argonTo(currentBidPrice)) }}
        </div>
        <p class="text-center text-lg mt-6 border-t border-b border-gray-300 pt-7 pb-6 font-light leading-7.5">
          This auction will begin closing in 
          <template v-if="hoursRemaining">{{ hoursRemaining }} hours, </template>
          <template v-if="minutesRemaining">{{ minutesRemaining }} minutes and </template>
          {{ secondsRemaining }} seconds.<br />
          Your account allows for an additional bid raise of {{configStore.currencySymbol}}{{ addCommas(configStore.argonTo(remainingBidBudget)) }} if needed.
        </p>
        <Popover as="div" class="relative text-center text-lg font-bold mt-8">
          <PopoverButton @click="viewActiveBids" class="border border-argon-300 text-argon-600 px-7 py-1 rounded cursor-pointer hover:bg-argon-50/40 hover:border-argon-600 transition-all duration-300 w-8/12">View Active Bids</PopoverButton>
          <PopoverPanel as="div" class="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-140 h-100 bg-white rounded-lg shadow-lg border border-gray-300">
            <div class="text-center text-base px-6 pt-5">
              <table class="w-full">
                <thead class="font-bold">
                  <tr>
                    <th class="text-left">Position</th>
                    <th class="text-left">Bid</th>
                    <th class="text-right">Time</th>
                  </tr>
                </thead>
                <tbody class="font-light">
                  <tr>
                    <td class="text-left">1</td>
                    <td class="text-left">{{configStore.currencySymbol}}{{ addCommas(configStore.argonTo(100)) }}</td>
                    <td class="text-right">2 seconds ago</td>
                  </tr>
                  <tr>
                    <td class="text-left">2</td>
                    <td class="text-left">{{configStore.currencySymbol}}{{ addCommas(configStore.argonTo(100)) }}</td>
                    <td class="text-right">3 minutes ago</td>
                  </tr>
                  <tr>
                    <td class="text-left">3</td>
                    <td class="text-left">{{configStore.currencySymbol}}{{ addCommas(configStore.argonTo(100)) }}</td>
                    <td class="text-right">4 minutes ago</td>
                  </tr>
                  <tr>
                    <td class="text-left">4</td>
                    <td class="text-left">{{configStore.currencySymbol}}{{ addCommas(configStore.argonTo(100)) }}</td>
                    <td class="text-right">5 minutes ago</td>
                  </tr>
                  <tr>
                    <td class="text-left">5</td>
                    <td class="text-left">{{configStore.currencySymbol}}{{ addCommas(configStore.argonTo(100)) }}</td>
                    <td class="text-right">6 minutes ago</td>
                  </tr>
                  
                </tbody>
              </table>
            </div>
          </PopoverPanel>
        </Popover>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useConfigStore } from '../../stores/config';
import { getMaxSeats } from '../../lib/bidding-calculator/createBidderParams';
import { addCommas } from '../../lib/Utils';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import mainchain from '../../lib/bidding-calculator/Mainchain';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';

dayjs.extend(utc);

const configStore = useConfigStore();

const seatPositions = Vue.ref([]);

const hoursRemaining = Vue.ref(0);
const minutesRemaining = Vue.ref(0);
const secondsRemaining = Vue.ref(0);

const seatCount = Vue.computed(() => {
  if (!configStore.biddingRules) return 0;

  return getMaxSeats(configStore.biddingRules);
});

const minBidPrice = Vue.computed(() => {
  if (!configStore.biddingRules) return 0;

  return configStore.biddingRules.startingAmount * seatCount.value;
});

const currentBidPrice = Vue.computed(() => {
  if (!configStore.biddingRules) return 0;

  return minBidPrice.value;
});

const maxBidPrice = Vue.computed(() => {
  if (!configStore.biddingRules) return 0;

  return configStore.biddingRules.finalAmount * seatCount.value;
});

const remainingBidBudget = Vue.computed(() => {
  if (!configStore.biddingRules) return 0;

  return Number(maxBidPrice.value) - Number(currentBidPrice.value);
});

function viewActiveBids() {
  console.log('viewActiveBids');
};

let startOfAuctionClosing: dayjs.Dayjs | null = null;

async function updateTimeRemaining() {
  if (!startOfAuctionClosing) {
    const tickAtStartOfAuctionClosing = await mainchain.getTickAtStartOfAuctionClosing();
    startOfAuctionClosing = dayjs.utc(Number(tickAtStartOfAuctionClosing) * 60 * 1000);
  }

  const now = dayjs.utc();
  const totalSeconds = startOfAuctionClosing.diff(now, 'seconds');
  hoursRemaining.value = Math.floor(totalSeconds / 3600);
  minutesRemaining.value = Math.floor((totalSeconds % 3600) / 60);
  secondsRemaining.value = totalSeconds % 60;

  if (totalSeconds > 0) {
    setTimeout(updateTimeRemaining, 1000);
  }
}

Vue.onMounted(() => {
  updateTimeRemaining();
});
</script>

<style scoped>
.fade-in-out {
  animation: fadeInOut 2s ease-in-out infinite;
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

