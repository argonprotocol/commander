<template>
  <TransitionRoot class='absolute inset-0' :show="isOpen">
    <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
      <div class="absolute inset-0 bg-gray-500/75 transition-opacity" />
    </TransitionChild>

    <div class="absolute inset-0 z-10 overflow-y-auto pt-[1px]">
      <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" enter-to="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200" leave-from="opacity-100 translate-y-0 sm:scale-100" leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
        <div class="relative transform overflow-hidden cursor-default select-none rounded-b-lg border-t-2 border-white bg-white px-4 pb-4 h-full text-left shadow-xl transition-all w-full">
          <div v-if="isLoaded" class="flex flex-col justify-between h-full">
            <h2 class="relative text-[2.75rem] font-bold text-fuchsia-800/30 text-center pt-6 py-5 mb-4">
              <div v-if="isClosing" isClosing>Mining Seat Bids Are In the Process of Closing</div>
              <template v-else>Bidding for The Next Mining Slot Closes In </template>
              <VueCountdown v-if="!isClosing" CountdownClock :time="millisecondsUntilEnd" v-slot="{ hours, minutes, seconds }">
                {{ hours.toString().padStart(2, '0') }}:{{ minutes.toString().padStart(2, '0') }}:{{ seconds.toString().padStart(2, '0') }}
              </VueCountdown>
              <div @click="closeBidderDialog" class="absolute top-10 right-4 rounded-full cursor-pointer hover:bg-[#faf0fd] border border-slate-300 w-6 h-6 flex items-center justify-center">
                <XMarkIcon class="w-4 h-4" />
              </div>
            </h2>
            <div class="flex flex-row justify-between grow space-x-6 mx-5 border-b border-slate-400">
              <div class="flex flex-col w-1/2 h-full">
                <div class="text-center border-y border-slate-400 pt-7 pb-6">
                  <span class="font-bold">Your Total Bid Cost</span>
                  <div class="text-[2.75rem] font-bold text-[#A600D4] py-2">
                    <InputDragger class="px-5 min-w-[80%] inline-block" :input="argonPremiumQty" :min="0" :max="MAX_BID_ARGON_PREMIUM" @change="v => setArgonPremium(v)">
                      {{currencySymbol}}{{addCommas(argonTo(totalCost).toFixed(2))}}
                    </InputDragger>
                  </div>
                  <div class="text-sm text-gray-500">
                    <template v-if="bidPosition > 0">This bid puts you in {{ordinal(bidPosition)}} place out of {{currentBids.length}} winning bids</template>
                    <template v-else>This places you below any of the {{currentBids.length}} winning bids</template>
                  </div>
                </div>
                <section class="flex flex-col grow pt-8 pb-12 px-5 h-full">
                  <header class="h-[12.5%]">Base Requirement</header>
                  <line end class="h-[12.5%]">
                    <div class="">{{ baseArgonotQty }} ARGNOTs</div>
                    <div>{{currencySymbol}}{{addCommas(argonotTo(baseArgonotQty))}}</div>
                  </line>

                  <div class="h-[12.5%]"></div>

                  <header class="h-[12.5%]">Competitive Premium</header>
                  <InputDragger class="h-[12.5%]" as="line" end :input="argonPremiumQty" :min="0" :max="MAX_BID_ARGON_PREMIUM" @change="v => setArgonPremium(v)">
                    <div>{{ addCommas(argonPremiumQty) }} ARGNs</div>
                    <div>{{currencySymbol}}{{addCommas(argonTo(argonPremiumQty))}}</div>
                  </InputDragger>

                  <div class="h-[12.5%]"></div>

                  <header class="h-[12.5%]">Transaction Fee</header>
                  <line end class="h-[12.5%]">
                    <div>
                      {{transactionFee}} ARGNs
                    </div>
                    <div>{{currencySymbol}}{{addCommas(argonTo(transactionFee))}}</div>
                  </line>

                  <div class="h-[12.5%]"></div>

                  <header class="h-[12.5%]">Token Adjustments</header>
                  <InputDragger class="h-[12.5%]" as="line" :input="expectedArgonotPriceChange" :min="-100" :max="100" @change="v => setExpectedArgonotPriceChange(v)">
                    <div class="">Expected ARGNOT Price Change</div>
                    <div>{{expectedArgonotPriceChange}}%</div>
                  </InputDragger>
                  <InputDragger class="h-[12.5%]" as="line" end :input="averageArgonMintingRate" :min="0" :max="1_000_000_000" :minChange="1" @change="v => setAverageArgonMintingRate(v)">
                    <div class="">Average ARGN Mining/Minting Rate</div>
                    <div>{{addCommas(averageArgonMintingRate)}}</div>
                  </InputDragger>

                </section>
              </div>
              <div class="bg-slate-300 w-[1px] relative" style="height: calc(100% - 20px);">
                <div class="absolute top-6 translate-y-1/2 right-0 translate-x-1/2 text-5xl font-bold bg-white py-2">=</div>
              </div>
              <div class="flex flex-col w-1/2 h-full">
                <div class="text-center border-y border-slate-400 pt-7 pb-6">
                  <span class="font-bold">Your<span class="cursor-pointer hover:bg-[#faf0fd] rounded-md px-1 py-0.5" @click="toggleAnnualized">{{isAnnualized ? 'Annualized' : 'Ten Day'}}</span>Return</span>
                  <div class="text-[2.75rem] font-bold text-[#A600D4] py-2">
                    <InputDragger class="px-5" :input="argonPremiumQty" :min="0" :max="MAX_BID_ARGON_PREMIUM" :reversed="true" @change="v => setArgonPremium(v)">{{formatAsPct(minimumReturn)}}%</InputDragger> 
                    <template v-if="minimumReturn !== anticipatedReturn">
                      <span class="font-light text-slate-500/70">to</span> 
                      <InputDragger class="px-5" :input="extraArgonsToBeMinted" :min="0" :max="MAX_ARGONS_TO_BE_MINTED" @change="v => extraArgonsToBeMinted = v">{{formatAsPct(anticipatedReturn)}}%</InputDragger>
                    </template>
                  </div>
                  <div class="text-sm text-gray-500">
                    <template v-if="minimumReturn !== anticipatedReturn">This range depends on how many extra argons are minted</template>
                    <template v-else>This is the minimum return based on protocol rules</template>
                  </div>
                </div>
                <section class="flex flex-col grow pt-8 pb-12 px-5 h-full">
                  <header class="h-[7.6923076923%]">Minimum Scenario</header>
                  <line class="h-[7.6923076923%]">
                    <div class="">{{addCommas(argonotsMinedPerSeat)}} ARGNOTs Mined per Seat</div>
                    <div>{{currencySymbol}}{{addCommas(argonotFinalTo(argonotsMinedPerSeat), 2)}}</div>
                  </line>
                  <line class="h-[7.6923076923%]">
                    <div class="">{{addCommas(argonsMinedPerSeat)}} ARGNs Mined per Seat</div>
                    <div>{{currencySymbol}}{{addCommas(argonTo(argonsMinedPerSeat), 2)}}</div>
                  </line>
                  <footer class="h-[7.6923076923%]">
                    <div class="">Total Block Rewards</div>
                    <div>{{currencySymbol}}{{addCommas(argonTo(totalMinimumRewards), 2)}}</div>
                  </footer>
                  <InputDragger class="h-[7.6923076923%] text-black/50" as="line" :input="expectedArgonotPriceChange" :min="-100" :max="100" @change="v => setExpectedArgonotPriceChange(v)">
                    <div class="">{{ baseArgonotQty }} Base ARGNOTs Unlocked</div>
                    <div>{{currencySymbol}}{{addCommas(argonotFinalTo(baseArgonotQty), 2)}}</div>
                  </InputDragger>
                  <InputDragger class="h-[7.6923076923%]" as="footer" end :input="argonPremiumQty" :min="0" :max="MAX_BID_ARGON_PREMIUM" :reversed="true" @change="v => setArgonPremium(v)">
                    <div class="">{{isAnnualized ? 'Annualized' : 'Ten Day'}} Return</div>
                    <div>{{formatAsPct(minimumReturn)}}%</div>
                  </InputDragger>

                  <div class="h-[7.6923076923%]"></div>

                  <header class="h-[7.6923076923%]">Optimistic Scenario</header>
                  <line class="h-[7.6923076923%]">
                    <div class="italic">Block Rewards from Minimum Scenario</div>
                    <div>{{currencySymbol}}{{addCommas(argonTo(totalMinimumRewards), 2)}}</div>
                  </line>
                  <InputDragger class="h-[7.6923076923%]" as="line" :input="extraArgonsToBeMinted" :min="0" :max="MAX_ARGONS_TO_BE_MINTED" @change="v => extraArgonsToBeMinted = v">
                    <div class="">{{addCommas(extraArgonsToBeMinted, 0)}} Extra ARGNs Minted / {{addCommas(SEAT_COUNT)}} Seats</div>
                    <div>{{currencySymbol}}{{addCommas(argonTo(extraArgonsToBeMintedPerSeat), 2)}}</div>
                  </InputDragger>
                  <InputDragger class="h-[7.6923076923%]" as="footer" :input="extraArgonsToBeMinted" :min="0" :max="MAX_ARGONS_TO_BE_MINTED" @change="v => extraArgonsToBeMinted = v">
                    <div class="">Total Block Rewards</div>
                    <div>{{currencySymbol}}{{addCommas(argonTo(totalAnticipatedRewards), 2)}}</div>
                  </InputDragger>
                  <InputDragger class="h-[7.6923076923%] text-black/50" as="line" :input="argonPremiumQty" :min="0" :max="MAX_BID_ARGON_PREMIUM" @change="v => setArgonPremium(v)">
                    <div class="">{{ baseArgonotQty }} Base ARGNOTs Unlocked</div>
                    <div>{{currencySymbol}}{{addCommas(argonotFinalTo(baseArgonotQty), 2)}}</div>
                  </InputDragger>
                  <InputDragger class="h-[7.6923076923%]" end as="footer" :input="extraArgonsToBeMinted" :min="0" :max="MAX_ARGONS_TO_BE_MINTED" @change="v => extraArgonsToBeMinted = v">
                    <div class="">{{isAnnualized ? 'Annualized' : 'Ten Day'}} Return</div>
                    <div>{{formatAsPct(anticipatedReturn)}}%</div>
                  </InputDragger>

                </section>
              </div>
            </div>
            <div class="flex flex-row justify-end items-center w-full text-right pt-5 pr-5 space-x-4">
              <div class="flex mr-5 items-center h-full underline decoration-dashed decoration-fuchsia-700/80 text-fuchsia-700/80 underline-offset-4 cursor-pointer">View Pending Bids</div>
              <button @click="closeBidderDialog" class="border border-[#A600D4]/50 text-xl font-bold text-[#A600D4] px-7 py-2 rounded-md block cursor-pointer">Cancel</button>
              <button class="bg-[#A600D4] text-xl font-bold text-white px-7 py-2 rounded-md block cursor-pointer">Submit Bid</button>
            </div>
          </div>
          
        </div>
      </TransitionChild>
    </div>
  </TransitionRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { TransitionChild, TransitionRoot } from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import emitter from '../emitters/basic';
import { addCommas } from '../lib/Utils';
import InputDragger from '../components/InputDragger.vue';
import mainchain from '../lib/Mainchain';
import VueCountdown from '@chenfengyuan/vue-countdown';
import ordinal from 'ordinal';
import { useAccountStore } from '../stores/account';
import { storeToRefs } from 'pinia'

const accountStore = useAccountStore();
const { argonotTo, argonotToArgon } = accountStore;
const { currencySymbol } = storeToRefs(accountStore);

dayjs.extend(utc);

const MAX_BID_ARGON_PREMIUM = 10_000;
const MAX_ARGONS_TO_BE_MINTED = 100_000_000;

const SEAT_COUNT = 100;
const BLOCKS_PER_EPOCH = 14400;
const DAYS_PER_EPOCH = 10;

const START_BID_IN_POSITION = 3;
const separateBidsBy = 0.01;
const currentBids: { bid: number, isMe: boolean }[] = [];

const argonotUsdValue = Vue.ref(2.0);
const argonUsdValue = Vue.ref(1.001);
const extraArgonsToBeMinted = Vue.ref(0);

const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);
const isClosing = Vue.ref(false);
const isAnnualized = Vue.ref(true);

let endTime = dayjs.utc().set('hour', 17).set('minute', 0).set('second', 0).set('millisecond', 0);
if (dayjs.utc().hour() < 17) {
  const startsClosingTime = dayjs.utc().set('hour', 16).set('minute', 40).set('second', 0).set('millisecond', 0);
  isClosing.value = dayjs.utc().isAfter(startsClosingTime);
} else {
  endTime = endTime.add(1, 'day');
}
const millisecondsUntilEnd = endTime.valueOf() - dayjs.utc().valueOf();

const baseArgonotQty = Vue.ref(0);

const expectedArgonotPriceChange = Vue.ref(0);

const transactionFee = Vue.ref(0.01);

const argonPremiumQty = Vue.ref(0);

const averageArgonMintingRate = Vue.ref(0);

const totalCost = Vue.ref(0);
const bidPosition = Vue.ref(0);

const argonotsMinedPerEpoch = Vue.ref(0);
const argonotsMinedPerSeat = Vue.ref(0);

const argonsMinedPerEpoch = Vue.ref(0);
const argonsMinedPerSeat = Vue.ref(0);

const extraArgonsToBeMintedPerSeat = Vue.ref(0);

const totalMinimumRewards = Vue.ref(0);

const minimumReturn = Vue.ref(0);
const anticipatedReturn = Vue.ref(0);
const totalAnticipatedRewards = Vue.ref(0);

Vue.watch(extraArgonsToBeMinted, () => {
  updateArgonsToBeMintedPerSeat();
});

let minimumTokensPerBlock = 0;

emitter.on('openBidderDialog', async () => {
  isOpen.value = true;
  isLoaded.value = false;

  minimumTokensPerBlock = await mainchain.currentArgonRewardsPerBlock();
  console.log('MINIMUM TOKENS PER BLOCK', minimumTokensPerBlock);

  argonotsMinedPerEpoch.value = minimumTokensPerBlock * BLOCKS_PER_EPOCH;
  argonotsMinedPerSeat.value = argonotsMinedPerEpoch.value / SEAT_COUNT;

  argonsMinedPerEpoch.value = minimumTokensPerBlock * BLOCKS_PER_EPOCH;
  argonsMinedPerSeat.value = argonsMinedPerEpoch.value / SEAT_COUNT;

  totalMinimumRewards.value = argonotFinalToArgon(argonotsMinedPerSeat.value) + argonsMinedPerSeat.value;

  baseArgonotQty.value = await mainchain.getOwnershipAmountMinimum(); 

  const winningBid = totalMinimumRewards.value + argonotFinalToArgon(baseArgonotQty.value) + transactionFee.value;
  const argonPremiumQty = winningBid - (transactionFee.value + argonotToArgon(baseArgonotQty.value) + (separateBidsBy * START_BID_IN_POSITION));
  
  currentBids.splice(0, currentBids.length);
  for (let i = 0; i < (SEAT_COUNT / DAYS_PER_EPOCH); i++) {
    currentBids.push({
      bid: winningBid - (i * separateBidsBy),
      isMe: false,
    });
  }

  argonUsdValue.value = await mainchain.getCurrentArgonTargetPrice();

  updateArgonsToBeMintedPerSeat();
  setArgonPremium(argonPremiumQty);
  updateBidTotalCost();
  
  isLoaded.value = true;
});

emitter.on('closeAllOverlays', () => {
  isOpen.value = false;
});

function toggleAnnualized() {
  isAnnualized.value = !isAnnualized.value;
  updateMinimumReturn();
  updateAnticipatedReturn();
}

function updateBidTotalCost() {
  totalCost.value = argonPremiumQty.value + transactionFee.value + argonotToArgon(baseArgonotQty.value);
  // Find position in current bids
  let position = 0;
  for (let i = 0; i < currentBids.length; i++) {
    if (totalCost.value > currentBids[i].bid) {
      position = i + 1;
      break;
    }
  }
  bidPosition.value = position;
}

function updateArgonsToBeMintedPerSeat() {
  extraArgonsToBeMintedPerSeat.value = extraArgonsToBeMinted.value / SEAT_COUNT;
  updateAnticipatedReturn();
}

function updateMinimumReturn() {
  totalMinimumRewards.value = argonotFinalToArgon(argonotsMinedPerSeat.value) + argonsMinedPerSeat.value;
  
  const argnotsValueReturned = argonotFinalToArgon(baseArgonotQty.value);
  const tmpMinimumReturn = (totalMinimumRewards.value + argnotsValueReturned - totalCost.value) / totalCost.value;
  // minimumReturn.value = isAnnualized.value ? (1 + tmpMinimumReturn) ** (365 / DAYS_PER_EPOCH) - 1 : tmpMinimumReturn;
  minimumReturn.value = isAnnualized.value ? tmpMinimumReturn * (365 / DAYS_PER_EPOCH) : tmpMinimumReturn;
}

function updateAnticipatedReturn() {
  totalAnticipatedRewards.value = argonotFinalToArgon(argonotsMinedPerSeat.value) + argonsMinedPerSeat.value + extraArgonsToBeMintedPerSeat.value;
  
  const argnotsValueReturned = argonotFinalToArgon(baseArgonotQty.value);
  const tmpAnticipatedReturn = (totalAnticipatedRewards.value + argnotsValueReturned - totalCost.value) / totalCost.value;
  // anticipatedReturn.value = isAnnualized.value ? (1 + tmpAnticipatedReturn) ** (365 / DAYS_PER_EPOCH) - 1 : tmpAnticipatedReturn;
  anticipatedReturn.value = isAnnualized.value ? tmpAnticipatedReturn * (365 / DAYS_PER_EPOCH) : tmpAnticipatedReturn;

  if (anticipatedReturn.value < 0) {
    setArgonPremium(argonPremiumQty.value);
  }
}

function setExpectedArgonotPriceChange(tmpExpectedArgonotPriceChange: number) {
  expectedArgonotPriceChange.value = tmpExpectedArgonotPriceChange;
  updateMinimumReturn();
  updateAnticipatedReturn();
}

function setAverageArgonMintingRate(tmpAverageArgonMintingRate: number) {
  averageArgonMintingRate.value = tmpAverageArgonMintingRate;

  argonsMinedPerEpoch.value = Math.max(minimumTokensPerBlock * BLOCKS_PER_EPOCH, averageArgonMintingRate.value);
  argonsMinedPerSeat.value = argonsMinedPerEpoch.value / SEAT_COUNT;

  updateMinimumReturn();
  updateAnticipatedReturn();
}

function setArgonPremium(tmpArgonPremiumQty: number) {
  const tmpBidTotalCost = tmpArgonPremiumQty + transactionFee.value + argonotToArgon(baseArgonotQty.value);
  if (tmpBidTotalCost > totalAnticipatedRewards.value) {
    argonPremiumQty.value = totalAnticipatedRewards.value - (transactionFee.value + argonotToArgon(baseArgonotQty.value));
    console.log('REDUCING THE BID', tmpArgonPremiumQty, 'TO', argonPremiumQty.value);
  } else {
    argonPremiumQty.value = tmpArgonPremiumQty;
  }
  updateBidTotalCost();
  updateMinimumReturn();
  updateAnticipatedReturn();
}

function formatAsPct(value: number) {
  value = value * 100;
  if (value < 100) {
    return value.toFixed(2);
  } else if (value < 1_000_000) {
    return addCommas(value, 0);
  } else {
    return addCommas(value / 1_000_000, 2) + 'M';
    // return value.toExponential(2);
  }
}

function argonotFinalTo(qtyInArgonots: number) {
  return argonotTo(qtyInArgonots * (1 + (expectedArgonotPriceChange.value / 100)));
}

function argonotFinalToArgon(qtyInArgonots: number) {
  return argonotToArgon(qtyInArgonots * (1 + (expectedArgonotPriceChange.value / 100)));
}

const closeBidderDialog = () => {
  isOpen.value = false;
};
</script>

<style scoped>
@reference "../main.css";


section {
  @apply text-sm;

  header {
    @apply flex flex-row justify-between items-center uppercase font-bold text-slate-500/60;
  }

  line {
    @apply flex flex-row justify-between items-center border-t border-slate-500/30;
  }

  footer {
    @apply flex flex-row justify-between items-center font-bold border-t border-slate-500;
  }

  footer[end], line[end] {
    @apply border-b border-b-slate-500;
  }
}

[InputDragger]:hover {
  @apply bg-linear-[90deg,rgba(250,240,253,0)_0%,rgba(250,240,253,1)_5%,rgba(250,240,253,1)_95%,rgba(250,240,253,0)_100%];
}

@keyframes pulseEffect {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.97);
  }
}

[isClosing] {
  animation: pulseEffect 1.5s ease-in-out infinite;
}
</style>