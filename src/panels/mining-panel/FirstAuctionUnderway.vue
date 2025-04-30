<template>
  <div class="flex flex-col h-full w-full p-3 cursor-default">
    <div class="grow relative bg-white rounded border border-[#CCCEDA] shadow text-center overflow-hidden">
      <img src="../../assets/confetti.svg" class="absolute top-[10px] left-[10px]" style="width: calc(100% - 20px);" />
      <div class="relative mx-auto inline-block">
        <h1 class="text-5xl font-bold text-center mt-32 mb-10 whitespace-nowrap">Your First Auction Is Live!</h1>
        
        <div class="text-center mt-6 mb-5 uppercase text-base flex flex-row justify-center items-center">
          <div class="h-[1px] bg-gray-300 w-1/2"></div>
          <div class="whitespace-nowrap px-5 text-gray-500">YOU ARE IN BID POSITION{{ seatPositions.length > 1 ? 'S' : '' }}</div>
          <div class="h-[1px] bg-gray-300 w-1/2"></div>
        </div>
        <div class="flex flex-col items-center justify-center min-h-[75px] fade-in-out">
          <div v-if="seatPositions.length" :class="[priceTextSize, 'text-center text-argon-600 font-bold']">
            {{ seatPositions.slice(0, -1).join(', ') + (seatPositions.length > 1 ? ' & ' : '') + seatPositions[seatPositions.length-1] }}
          </div>
          <div v-else class="text-center text-7xl text-argon-600 font-bold">
            --- --- --- ---
          </div>
        </div>
        <div class="text-center mt-6 mb-5 uppercase text-base flex flex-row justify-center items-center">
          <div class="h-[1px] bg-gray-300 w-1/2"></div>
          <div class="whitespace-nowrap px-5 text-gray-500">AT A {{ seatPositions.length ? 'COMBINED' : 'TOTAL' }} PRICE OF</div>
          <div class="h-[1px] bg-gray-300 w-1/2"></div>
        </div>
        <div class="flex flex-col items-center justify-center min-h-[75px] fade-in-out">
          <div v-if="seatPositions.length" :class="[priceTextSize, 'text-center text-argon-600 font-bold']">
            {{configStore.currencySymbol}}{{ addCommas(configStore.argonTo(currentBidPrice)) }}
          </div>
          <div v-else class="text-center text-7xl text-argon-600 font-bold">
            {{configStore.currencySymbol}}--.--
          </div>
        </div>
        <p class="text-center text-lg mt-6 border-t border-b border-gray-300 pt-8 pb-7 font-light leading-7.5">
          <template v-if="auctionIsClosing">
            This auction is in the process of closing. Bids can still be submitted for the<br />
            next
            <CountdownClock :time="startOfAuctionClosing" @tick="handleAuctionClosingTick" v-slot="{ hours, minutes, seconds }">
              <template v-if="hours">{{ hours }} hour{{ hours > 1 ? 's' : '' }}, </template>
              <template v-if="minutes">{{ minutes }} minute{{ minutes > 1 ? 's' : '' }} and </template>
              {{ seconds }} second{{ seconds > 1 ? 's' : '' }}
            </CountdownClock>
          </template>
          <template v-else>
            This auction will begin closing in 
            <CountdownClock :time="startOfNextCohort" v-slot="{ hours, minutes, seconds }">
              <template v-if="hours">{{ hours }} hour{{ hours > 1 ? 's' : '' }}, </template>
              <template v-if="minutes">{{ minutes }} minute{{ minutes > 1 ? 's' : '' }} and </template>
              {{ seconds }} second{{ seconds > 1 ? 's' : '' }}
            </CountdownClock>.<br />
            Your account allows for an additional bid raise of {{configStore.currencySymbol}}{{ addCommas(configStore.argonTo(remainingBidBudget)) }} if needed.
          </template>          
        </p>
        <Popover as="div" class="relative text-center text-lg font-bold mt-10">
          <PopoverButton class="focus:outline-none border border-argon-300 text-argon-600 px-7 py-2 rounded cursor-pointer hover:bg-argon-50/40 hover:border-argon-600 transition-all duration-300 w-10/12">View Active Bids</PopoverButton>
          <PopoverPanel as="div" class="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 cursor-default w-160 h-120 bg-white rounded-lg shadow-lg border border-gray-300">
            <div class="absolute top-full left-1/2 -translate-x-1/2 w-[30px] h-[15px] rotate-180 overflow-hidden">
              <div class="relative top-[5px] left-[5px] w-[20px] h-[20px] rotate-45 bg-white ring-1 ring-gray-900/20"></div>
            </div>
            <div class="text-center text-base px-6 pt-5 pb-3 h-full">
              <table class="w-full h-full">
                <thead class="font-bold">
                  <tr>
                    <th class="text-left"></th>
                    <th class="text-left">Bid Amount</th>
                    <th class="text-left">Submitted</th>
                    <th class="text-right">Account</th>
                  </tr>
                </thead>
                <tbody class="font-light font-mono">
                  <tr v-for="(bid, index) in activeBids" :key="bid.accountId">
                    <td class="text-left">{{ index + 1 }}</td>
                    <td class="text-left">{{configStore.currencySymbol}}{{ addCommas(configStore.argonTo(bid.amount)) }}</td>
                    <td class="text-left">recently</td>
                    <td class="text-right relative">
                      {{ bid.accountId.slice(0, 10) }}...{{ bid.accountId.slice(-7) }}
                      <span v-if="bid.isMine" class="absolute right-0 top-1/2 -translate-y-1/2 bg-argon-600 text-white px-1.5 pb-0.25 rounded text-sm">ME<span class="absolute top-0 -left-3 inline-block h-full bg-gradient-to-r from-transparent to-white w-3"></span></span>
                    </td>
                  </tr>
                  <tr v-for="i in 10 - activeBids.length" :key="i">
                    <td class="text-left">{{ activeBids.length + i }}</td>
                    <td class="text-left text-gray-400">---</td>
                    <td class="text-left text-gray-400">---</td>
                    <td class="text-right text-gray-400">-------------</td>
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
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import mainchain from '../../lib/bidding-calculator/Mainchain';
import IBiddingRules from '../../lib/bidding-calculator/IBiddingRules';
import { useConfigStore } from '../../stores/config';
import { Helper as BiddingParamsHelper } from '../../lib/bidding-calculator/createBidderParams';
import { addCommas } from '../../lib/Utils';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
import { useBlockchainStore, type IActiveBid } from '../../stores/blockchain';
import CountdownClock from '../../components/CountdownClock.vue';

dayjs.extend(utc);

const configStore = useConfigStore();
const blockchainStore = useBlockchainStore();

const auctionIsClosing = Vue.ref(false);

const activeBids = Vue.ref<IActiveBid[]>([]);
const bidderData = Vue.ref<any>(null);

const maxBidPrice = Vue.ref(0);
const currentBidPrice = Vue.ref(0);
const remainingBidBudget = Vue.ref(0);
const seatPositions = Vue.ref<number[]>([]);

const priceTextSize = Vue.computed(() => {
  return seatPositions.value.length > 8 ? 'text-6xl' : 'text-7xl';
});

const biddingParamsHelper = new BiddingParamsHelper(configStore.biddingRules as IBiddingRules);

let startOfAuctionClosing: Vue.Ref<dayjs.Dayjs | null> = Vue.ref(null);
let startOfNextCohort: Vue.Ref<dayjs.Dayjs | null> = Vue.ref(null);

function handleAuctionClosingTick(totalSecondsRemaining: number) {
  if (totalSecondsRemaining <= 0) {
    auctionIsClosing.value = true;
  }
}

function convertStringToBigInt(str: string) {
  return BigInt(str.slice(0, -1));
}

function processBidderData() {
  const seatCount = bidderData.value.subaccounts.length;
  const totalArgonsBid = Number(convertStringToBigInt(bidderData.value.totalArgonsBid));
  currentBidPrice.value = totalArgonsBid * seatCount;
  remainingBidBudget.value = maxBidPrice.value - currentBidPrice.value;
  seatPositions.value = [];

  for (const bid of activeBids.value) {
    const bidIndex = bidderData.value.subaccounts.findIndex((s: any) => s.address === bid.accountId);
    if (bidIndex !== -1) {
      seatPositions.value.push(bidIndex + 1);
      bid.isMine = true;
    }
  }
  
}

Vue.onMounted(async () => {
  if (!configStore.biddingRules) return;
  
  blockchainStore.subscribeToActiveBids(newActiveBids => {
    activeBids.value = newActiveBids;
    if (!bidderData.value) {
      console.log('no bidder data');
      return;
    }
    processBidderData();
  });

  configStore.subscribeToBidderData(newBidderData => {
    bidderData.value = newBidderData;
    if (!activeBids.value.length) {
      return;
    }
    processBidderData();  
  });

  if (!startOfAuctionClosing || !startOfNextCohort) {
    const tickAtStartOfAuctionClosing = await mainchain.getTickAtStartOfAuctionClosing();
    const tickAtStartOfNextCohort = await mainchain.getTickAtStartOfNextCohort();
    startOfAuctionClosing.value = dayjs.utc(Number(tickAtStartOfAuctionClosing) * 60 * 1000);
    startOfNextCohort.value = dayjs.utc(Number(tickAtStartOfNextCohort) * 60 * 1000);
  }

  const seatCount = await biddingParamsHelper.getMaxSeats();
  maxBidPrice.value = configStore.biddingRules.finalAmount * seatCount;
  remainingBidBudget.value = maxBidPrice.value - currentBidPrice.value;
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