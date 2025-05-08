<template>
  <div class="flex flex-col h-full">
    <div v-if="false" @click="openFundMiningWalletOverlay" class="flex flex-row items-center gap-x-3 cursor-pointer bg-[#C253E1] text-white px-3.5 py-2 border-b border-[#A601D4]" style="box-shadow: inset 0 2px 2px rgba(0, 0, 0, 0.1)">
      <AlertIcon class="w-4 h-4 text-white relative left-1 inline-block" />
      <div class="font-bold grow">Your Mining Wallet is low on funds which may inhibit bidding. </div>
      <span class="cursor-pointer inline-block rounded-full bg-[#79009B] px-3">Add Funds</span>
    </div>
    <div v-else-if="configStore.isDataSyncing" class="flex flex-row items-center gap-x-3 cursor-pointer bg-[#C253E1] text-white px-3.5 py-2 border-b border-[#A601D4]" style="box-shadow: inset 0 2px 2px rgba(0, 0, 0, 0.1)">
      <AlertIcon class="w-4 h-4 text-white relative left-1 inline-block" />
      <div v-if="configStore.dataSync.type === 'server'" class="font-bold grow">Your server data is being synced </div>
      <div v-else-if="configStore.dataSync.type === 'db'" class="font-bold grow">Updating your stats database </div>
      <div>{{ configStore.dataSync.progress.toFixed(0) }}%</div>
    </div>

    <div :class="configStore.isDataSyncing ? 'opacity-30 pointer-events-none' : ''" class="flex flex-col h-full px-3.5 py-3 gap-y-2.5 justify-stretch grow">
      <section class="flex flex-row gap-x-3">
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>{{ globalStats.activeCohorts || 0 }}</span>
          <label>Active Cohorts</label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>{{ globalStats.activeSeats || 0 }}</span>
          <label>Active Seats</label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>{{ formatLargeNumber(globalStats.totalBlocksMined || 0) }}</span>
          <label>Total Blocks Mined</label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>{{ currencySymbol }}{{ formatLargeNumber(argonTo(globalArgonsInvested/1_000_000)) }}</span>
          <label>Total Invested</label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>{{ currencySymbol }}{{ formatLargeNumber(argonTo(globalArgonsEarned/1_000_000)) }}</span>
          <label>Total Earned</label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>{{ addCommas(globalAPY) }}%</span>
          <label>Current APY</label>
        </div>
      </section>

      <section box class="flex flex-col text-center px-2">
        <header class="text-xl font-bold py-2 text-slate-900/80 border-b border-slate-400/30">YOUR CLOUD MACHINE IS LIVE</header>
        <div class="flex flex-row py-2">
          <div class="flex flex-row w-4/12 items-center justify-center gap-x-2 pb-2 pt-3">
            <span class="opacity-50">Last Bitcoin Block</span>
            <CountupClock as="span" :time="lastBitcoinActivityAt" v-slot="{ hours, minutes, seconds, isNull }">
              <template v-if="hours">{{ hours }}h, </template>
              <template v-if="minutes">{{ minutes }}m and </template>
              <template v-if="!isNull">{{ seconds }}s ago</template>
              <template v-else>-- ----</template>
            </CountupClock>
          </div>
          <div class="h-full w-[1px] bg-slate-400/30"></div>
          <div class="flex flex-row w-4/12 items-center justify-center gap-x-2 pb-2 pt-3">
            <span class="opacity-50">Last Argon Block</span>
            <CountupClock as="span" :time="lastArgonActivityAt" v-slot="{ hours, minutes, seconds, isNull }">
              <template v-if="hours">{{ hours }}h, </template>
              <template v-if="minutes">{{ minutes }}m and </template>
              <template v-if="!isNull">{{ seconds }}s ago</template>
              <template v-else>-- ----</template>
            </CountupClock>
          </div>
          <div class="h-full w-[1px] bg-slate-400/30"></div>
          <div class="flex flex-row w-4/12 items-center justify-center gap-x-2 pb-2 pt-3">
            <span class="opacity-50">Last Bidding Activity</span>
            <CountupClock as="span" :time="lastBotActivityAt" v-slot="{ hours, minutes, seconds, isNull }">
              <template v-if="hours">{{ hours }}h, </template>
              <template v-if="minutes">{{ minutes }}m and </template>
              <template v-if="!isNull">{{ seconds }}s ago</template>
              <template v-else>-- ----</template>
            </CountupClock>
          </div>
        </div>
      </section>

      <section box class="flex flex-col grow text-center px-2">
        <header class="flex flex-row justify-between text-xl font-bold py-2 text-slate-900/80 border-b border-slate-400/30">
          <div class="flex flex-row items-center opacity-50 font-light text-base cursor-pointer">
            <ChevronLeftIcon class="w-6 h-6 opacity-50 mx-1" />
            PREV SLOT
          </div>
          <span class="flex flex-row items-center">
            COHORT #{{ cohortStats.frameIdAtCohortActivation }} ({{cohortStartDate}} - {{cohortEndDate}})
            <span class="inline-block rounded-full bg-green-500/80 w-2.5 h-2.5 ml-2"></span>
          </span>
          <div class="flex flex-row items-center opacity-50 font-light text-base cursor-pointer">
            NEXT SLOT
            <ChevronRightIcon class="w-6 h-6 opacity-50 mx-1" />
          </div>
        </header>
        <div class="flex flex-row h-full">
          <div class="flex flex-col w-1/2 h-full pt-2 gap-y-2">
            <div class="flex flex-row w-full h-1/2 gap-x-2">
              <div stat-box class="flex flex-col w-1/3 h-full border-b border-slate-400/30">
                <span>{{ cohortStats.seatsWon }}</span>
                <label>Active Seats</label>
              </div>
              <div class="h-full w-[1px] bg-slate-400/30"></div>
              <div stat-box class="flex flex-col w-1/3 h-full border-b border-slate-400/30">
                <span>{{ addCommas((cohortStats.argonsMined + cohortStats.argonsMinted) / 1_000_000) }}</span>
                <label>Argons Earned</label>
              </div>
              <div class="h-full w-[1px] bg-slate-400/30"></div>
              <div stat-box class="flex flex-col w-1/3 h-full border-b border-slate-400/30">
                <span>{{ addCommas(cohortStats.argonotsMined / 1_000_000) }}</span>
                <label>Argonots Earned</label>
              </div>
              <div class="h-full w-[1px] bg-slate-400/30"></div>
            </div>
            <div class="flex flex-row w-full h-1/2 gap-x-2">
              <div stat-box class="flex flex-col w-1/3 h-full">
                <span>{{ currencySymbol }}{{ addCommas(cohortArgonsInvested / 1_000_000) }}</span>
                <label>Total Invested</label>
              </div>
              <div class="h-full w-[1px] bg-slate-400/30"></div>
              <div stat-box class="flex flex-col w-1/3 h-full">
                <span>{{ currencySymbol }}{{ addCommas(cohortArgonsEarned / 1_000_000) }}</span>
                <label>Expected Earnings</label>
              </div>
              <div class="h-full w-[1px] bg-slate-400/30"></div>
              <div stat-box class="flex flex-col w-1/3 h-full">
                <span>{{ addCommas(cohortAPY) }}%</span>
                <label>Expected APY</label>
              </div>
              <div class="h-full w-[1px] bg-slate-400/30"></div>
            </div>
          </div>
          <div class="flex flex-col w-1/2 pl-3 pt-2">
            <table>
              <thead>
                <tr class="text-md text-gray-500 text-left">
                  <th class="py-2 border-b border-slate-400/30 pl-1">Block</th>
                  <th class="py-2 border-b border-slate-400/30">Time</th>
                  <th class="py-2 border-b border-slate-400/30">Earned</th>
                  <th class="py-2 border-b border-slate-400/30 text-right pr-3">Author</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
            <div class="flex flex-col justify-center items-center grow">
              <span>
                <img src="/mining.gif" class="w-16 opacity-20 inline-block relative -left-1">
              </span>
              <div class="flex flex-col items-center opacity-30 mt-5">
                <div class="text-lg font-bold">No Blocks Have Been Mined</div>
                <div>(waiting for miner to submit first block)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section box class="relative flex flex-col h-[20%] min-h-32 !pb-0.5 px-2">
        <div nib-handle class="absolute -top-1 -bottom-1 left-[29.5890411%] w-2 bg-white rounded-full border border-slate-400/50 shadow-md z-10">
          <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full border border-slate-400/50 shadow-md"></div>
        </div>
        <div class="absolute top-[1px] bottom-[33px] left-[29.5890411%] w-[2.739726027%] bg-gradient-to-b from-transparent to-argon-button/10"></div>
        <div class="grow relative">
          <div class="absolute bottom-[-1px] left-0 w-[4.109589041%] h-[0px] border-[4px] border-argon-button/10 border-dotted"></div>
          <div class="absolute bottom-[-1px] left-[4.109589041%] w-[10.684931509%] h-0 border-[4px] border-argon-button/10"></div>
          <div class="absolute bottom-[-1px] left-[14.79452055%] w-[14.79452055%] h-0 border-[4px] border-argon-button"></div>
        </div>
        <ul class="flex flex-row text-md opacity-50 divide-x divide-slate-400/70 text-center w-full border-t border-slate-400/60 pt-2">
          <li class="flex-1">Jan</li>
          <li class="flex-1">Feb</li>
          <li class="flex-1">Mar</li>
          <li class="flex-1">Apr</li>
          <li class="flex-1">May</li>
          <li class="flex-1">Jun</li>
          <li class="flex-1">Jul</li>
          <li class="flex-1">Aug</li>
          <li class="flex-1">Sep</li>
          <li class="flex-1">Oct</li>
          <li class="flex-1">Nov</li>
          <li class="flex-1">Dec</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { storeToRefs } from 'pinia';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import { addCommas, calculateAPY, showDecimalsIfNeeded } from '../../lib/Utils';
import { useConfigStore } from '../../stores/config';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/24/outline';
import AlertIcon from '../../assets/alert.svg';
import emitter from '../../emitters/basic';
import CountupClock from '../../components/CountupClock.vue';

dayjs.extend(relativeTime);
dayjs.extend(utc);

const configStore = useConfigStore();
const { argonTo, argonotToArgon } = configStore;
const { currencySymbol, globalStats, cohortStats } = storeToRefs(configStore);

const globalArgonsEarned = Vue.computed(() => {
  return globalStats.value.totalArgonsMined +
    globalStats.value.totalArgonsMinted +
    argonotToArgon(globalStats.value.totalArgonotsMined);
});

const globalArgonsInvested = Vue.computed(() => {
  return globalStats.value.totalArgonsBid + globalStats.value.totalTransactionFees;
});

const globalAPY = Vue.computed(() => {
  return calculateAPY(globalArgonsInvested.value, globalArgonsEarned.value);
});

const cohortArgonsEarned = Vue.computed(() => {
  return cohortStats.value.argonsMined + cohortStats.value.argonsMinted + argonotToArgon(cohortStats.value.argonotsMined);
});

const cohortArgonsInvested = Vue.computed(() => {
  return cohortStats.value.argonsBid + cohortStats.value.transactionFees;
});

const cohortAPY = Vue.computed(() => {
  return calculateAPY(cohortArgonsInvested.value, cohortArgonsEarned.value);
});

const cohortStartDate = Vue.computed(() => {
  if (!cohortStats.value.frameTickStart) {
    return '-----';
  }
  const date = dayjs.utc(cohortStats.value.frameTickStart * 60e3);
  return date.local().format('MMMM D');
});

const cohortEndDate = Vue.computed(() => {
  if (!cohortStats.value.frameTickEnd) {
    return '-----';
  }
  const date = dayjs.utc(cohortStats.value.frameTickEnd * 60e3);
  return date.local().format('MMMM D');
});

const lastBitcoinActivityAt = Vue.computed(() => {
  const lastActivity = configStore.bitcoinActivity[0];
  return lastActivity ? dayjs.utc(lastActivity.insertedAt) : null;
});

const lastArgonActivityAt = Vue.computed(() => {
  const lastActivity = configStore.argonActivity[0];
  return lastActivity ? dayjs.utc(lastActivity.insertedAt) : null;
});

const lastBotActivityAt = Vue.computed(() => {
  const lastActivity = configStore.botActivity[0];
  return lastActivity ? dayjs.utc(lastActivity.insertedAt) : null;
});

function openFundMiningWalletOverlay() {
  emitter.emit('openWalletOverlay', { walletId: 'mng', screen: 'receive' });
}

function formatLargeNumber(number: number, maxLength = 5) {
  if (number < (10 ** (maxLength - 2))) { // 1_000
    return showDecimalsIfNeeded(number, 2, 2);
  } else if (number < (99 ** (maxLength - 2))) { // 99_000
    return addCommas(number, 0);
  }
  return number;
  // return (number / 1_000_000).toFixed(1) + 'M';
}
</script>

<style scoped>
@reference "../../main.css";

[box] {
  @apply bg-white rounded shadow min-h-20 border-[1px] border-slate-400/30 py-2;
}

[stat-box] {
  @apply flex flex-col items-center justify-center text-[#963EA7];
  span {
    @apply text-4xl font-bold;
  }
  label {
    @apply text-sm text-gray-500 mt-1;
  }
}
</style>