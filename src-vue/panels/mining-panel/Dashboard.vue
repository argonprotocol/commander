<template>
  <div class="flex flex-col h-full cursor-default">
    <AlertBars />

    <div
      :class="stats.isLoaded ? '' : 'opacity-30 pointer-events-none'"
      class="flex flex-col h-full px-3.5 py-3 gap-y-2.5 justify-stretch grow"
    >
      <section class="flex flex-row gap-x-3">
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>{{ stats.dashboard.global.activeCohorts || 0 }}</span>
          <label>Active Cohort{{ stats.dashboard.global.activeCohorts === 1 ? '' : 's' }}</label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>{{ stats.dashboard.global.activeSeats || 0 }}</span>
          <label>Active Seat{{ stats.dashboard.global.activeSeats === 1 ? '' : 's' }}</label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>{{ formatLargeNumber(stats.dashboard.global.totalBlocksMined || 0) }}</span>
          <label>
            Total Block{{ stats.dashboard.global.totalBlocksMined === 1 ? '' : 's' }} Mined
          </label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span
            >{{ currencySymbol
            }}{{ formatLargeNumber(argonTo(globalArgonsInvested / 1_000_000)) }}</span
          >
          <label>Total Invested</label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span
            >{{ currencySymbol
            }}{{ formatLargeNumber(argonTo(globalArgonsEarned / 1_000_000)) }}</span
          >
          <label>Total Earned</label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>{{ fmtCommas(globalAPY) }}%</span>
          <label>Current APY</label>
        </div>
      </section>

      <section box class="flex flex-col text-center px-2">
        <header class="text-xl font-bold py-2 text-slate-900/80 border-b border-slate-400/30">
          YOUR CLOUD MACHINE IS LIVE
        </header>
        <div class="flex flex-row py-2">
          <div class="flex flex-row w-4/12 items-center justify-center gap-x-2 pb-2 pt-3">
            <span class="opacity-50">Last Bitcoin Block</span>
            <CountupClock
              as="span"
              :time="lastBitcoinActivityAt"
              v-slot="{ hours, minutes, seconds, isNull }"
            >
              <template v-if="hours">{{ hours }}h, </template>
              <template v-if="minutes">{{ minutes }}m and </template>
              <template v-if="!isNull">{{ seconds }}s ago</template>
              <template v-else>-- ----</template>
            </CountupClock>
          </div>
          <div class="h-full w-[1px] bg-slate-400/30"></div>
          <div class="flex flex-row w-4/12 items-center justify-center gap-x-2 pb-2 pt-3">
            <span class="opacity-50">Last Argon Block</span>
            <CountupClock
              as="span"
              :time="lastArgonActivityAt"
              v-slot="{ hours, minutes, seconds, isNull }"
            >
              <template v-if="hours">{{ hours }}h, </template>
              <template v-if="minutes">{{ minutes }}m and </template>
              <template v-if="!isNull">{{ seconds }}s ago</template>
              <template v-else>-- ----</template>
            </CountupClock>
          </div>
          <div class="h-full w-[1px] bg-slate-400/30"></div>
          <div class="flex flex-row w-4/12 items-center justify-center gap-x-2 pb-2 pt-3">
            <span class="opacity-50">Last Bidding Activity</span>
            <CountupClock
              as="span"
              :time="lastBotActivityAt"
              v-slot="{ hours, minutes, seconds, isNull }"
            >
              <template v-if="hours">{{ hours }}h, </template>
              <template v-if="minutes">{{ minutes }}m and </template>
              <template v-if="!isNull">{{ seconds }}s ago</template>
              <template v-else>-- ----</template>
            </CountupClock>
          </div>
        </div>
      </section>

      <section box class="flex flex-col grow text-center px-2">
        <header
          class="flex flex-row justify-between text-xl font-bold py-2 text-slate-900/80 border-b border-slate-400/30"
        >
          <div
            @click="goToPreviousCohort"
            class="flex flex-row items-center opacity-50 font-light text-base cursor-pointer group hover:opacity-80"
          >
            <ChevronLeftIcon class="w-6 h-6 opacity-50 mx-1 group-hover:opacity-80" />
            PREV SLOT
          </div>
          <span class="flex flex-row items-center">
            COHORT #{{ stats.dashboard.cohort?.cohortId }} ({{ cohortStartDate }} -
            {{ cohortEndDate }})
            <span class="inline-block rounded-full bg-green-500/80 w-2.5 h-2.5 ml-2"></span>
          </span>
          <div
            @click="goToNextCohort"
            class="flex flex-row items-center opacity-50 font-light text-base cursor-pointer group hover:opacity-80"
          >
            NEXT SLOT
            <ChevronRightIcon class="w-6 h-6 opacity-50 mx-1 group-hover:opacity-80" />
          </div>
        </header>
        <div v-if="stats.dashboard.cohort" class="flex flex-row h-full">
          <div class="flex flex-col w-1/2 h-full pt-2 gap-y-2">
            <div class="flex flex-row w-full h-1/2 gap-x-2">
              <div stat-box class="flex flex-col w-1/3 h-full border-b border-slate-400/30">
                <span>{{ stats.dashboard.cohort.seatsWon }}</span>
                <label>Active Seats</label>
              </div>
              <div class="h-full w-[1px] bg-slate-400/30"></div>
              <div stat-box class="flex flex-col w-1/3 h-full border-b border-slate-400/30">
                <span>{{
                  fmtCommas(
                    fmtDecimalsMax(
                      (stats.dashboard.cohort.argonsMined + stats.dashboard.cohort.argonsMinted) /
                        1_000_000,
                      2,
                    ),
                  )
                }}</span>
                <label>Argons Earned</label>
              </div>
              <div class="h-full w-[1px] bg-slate-400/30"></div>
              <div stat-box class="flex flex-col w-1/3 h-full border-b border-slate-400/30">
                <span>{{
                  fmtCommas(fmtDecimalsMax(stats.dashboard.cohort.argonotsMined / 1_000_000, 2))
                }}</span>
                <label>Argonots Earned</label>
              </div>
              <div class="h-full w-[1px] bg-slate-400/30"></div>
            </div>
            <div class="flex flex-row w-full h-1/2 gap-x-2">
              <div stat-box class="flex flex-col w-1/3 h-full">
                <span>{{ currencySymbol }}{{ fmtMoney(cohortArgonsInvested / 1_000_000) }}</span>
                <label>Total Invested</label>
              </div>
              <div class="h-full w-[1px] bg-slate-400/30"></div>
              <div stat-box class="flex flex-col w-1/3 h-full">
                <span>{{ currencySymbol }}{{ fmtMoney(cohortArgonsEarned / 1_000_000) }}</span>
                <label>Expected Earnings</label>
              </div>
              <div class="h-full w-[1px] bg-slate-400/30"></div>
              <div stat-box class="flex flex-col w-1/3 h-full">
                <span>{{ fmtCommas(fmtDecimalsMax(cohortAPY, 2)) }}%</span>
                <label>Expected APY</label>
              </div>
              <div class="h-full w-[1px] bg-slate-400/30"></div>
            </div>
          </div>
          <div class="flex flex-col w-1/2 pl-3 pt-2">
            <table class="relative h-full">
              <thead>
                <tr class="text-md text-gray-500 text-left">
                  <th
                    class="py-2 border-b border-slate-400/30 pl-1"
                    :style="{ height: `${blocks.length + 1 / 100}%` }"
                  >
                    Block
                  </th>
                  <th class="py-2 border-b border-slate-400/30">Time</th>
                  <th class="py-2 border-b border-slate-400/30">Earned</th>
                  <th class="py-2 border-b border-slate-400/30 text-right pr-3">Author</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="block in blocks" :key="block.number" class="text-gray-500">
                  <td
                    class="text-left border-t border-slate-400/30"
                    :style="{ height: `${blocks.length + 1 / 100}%` }"
                  >
                    ...{{ block.number.toString().slice(-4) }}
                  </td>
                  <td class="text-left border-t border-slate-400/30">
                    {{ block.timestamp.fromNow() }}
                  </td>
                  <td class="text-left border-t border-slate-400/30">
                    {{ currencySymbol
                    }}{{ fmtMoney(argonotToArgon(block.argonots) + block.argons) }}
                  </td>
                  <td class="text-right border-t border-slate-400/30">
                    {{ abreviateAddress(block.author, 10) }}
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="!blocks.length" class="flex flex-col justify-center items-center grow pt-8">
              <span>
                <img src="/mining.gif" class="w-16 opacity-20 inline-block relative -left-1" />
              </span>
              <div class="flex flex-col items-center opacity-30 mt-5">
                <div class="text-lg font-bold">No Blocks Have Been Mined</div>
                <div>(miners are actively working on first block)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section box class="relative flex flex-col h-[20%] min-h-32 !pb-0.5 px-2">
        <div
          nib-handle
          class="absolute -top-1 -bottom-1 w-2 bg-white rounded-full border border-slate-400/50 shadow-md z-10"
          :style="{ left: `${percentOfYear}%` }"
        >
          <div
            class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rounded-full border border-slate-400/50 shadow-md"
          ></div>
        </div>
        <div
          class="absolute top-[1px] bottom-[33px] w-[2.739726027%] bg-gradient-to-b from-transparent to-argon-button/10"
          :style="{ left: `${percentOfYear}%` }"
        ></div>
        <div class="grow relative">
          <div
            class="absolute bottom-[-1px] left-0 w-[4.109589041%] h-[0px] border-[4px] border-argon-button/10 border-dotted"
          ></div>
          <div
            class="absolute bottom-[-1px] left-[4.109589041%] w-[10.684931509%] h-0 border-[4px] border-argon-button/10"
          ></div>
          <div
            class="absolute bottom-[-1px] left-[14.79452055%] h-0 border-[4px] border-argon-button"
            :style="{ width: `${percentOfYear - 14.79452055}%` }"
          ></div>
        </div>
        <ul
          class="flex flex-row text-md opacity-50 divide-x divide-slate-400/70 text-center w-full border-t border-slate-400/60 pt-2"
        >
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
import {
  fmtCommas,
  fmtMoney,
  calculateAPY,
  fmtDecimals,
  fmtDecimalsMax,
  abreviateAddress,
} from '../../lib/Utils';
import { useStats } from '../../stores/stats';
import { useCurrencyStore } from '../../stores/currency';
import { useBlockchainStore } from '../../stores/blockchain';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/24/outline';
import CountupClock from '../../components/CountupClock.vue';
import AlertBars from '../../components/AlertBars.vue';
import { IBlock } from '../../stores/blockchain';

dayjs.extend(relativeTime);
dayjs.extend(utc);

const stats = useStats();
const currencyStore = useCurrencyStore();
const blockchainStore = useBlockchainStore();

const { argonTo, argonotToArgon } = currencyStore;
const { currencySymbol } = storeToRefs(currencyStore);

const dayInYear = dayjs().diff(dayjs().startOf('year'), 'days') + 1;
const percentOfYear = Math.min(dayInYear / 365, 1) * 100;

const currentCohortId = Vue.ref(0);
const blocks = Vue.ref<IBlock[]>([]);

const globalArgonsEarned = Vue.computed(() => {
  const global = stats.dashboard.global;
  return (
    global.totalArgonsMined + global.totalArgonsMinted + argonotToArgon(global.totalArgonotsMined)
  );
});

const globalArgonsInvested = Vue.computed(() => {
  const global = stats.dashboard.global;
  return global.totalArgonsBid + global.totalTransactionFees;
});

const globalAPY = Vue.computed(() => {
  return calculateAPY(globalArgonsInvested.value, globalArgonsEarned.value);
});

const cohortArgonsEarned = Vue.computed(() => {
  const cohort = stats.dashboard.cohort;
  if (!cohort) return 0;
  return cohort.argonsMined + cohort.argonsMinted + argonotToArgon(cohort.argonotsMined);
});

const cohortArgonsInvested = Vue.computed(() => {
  const cohort = stats.dashboard.cohort;
  if (!cohort) return 0;
  return cohort.argonsBid + cohort.transactionFees;
});

const cohortAPY = Vue.computed(() => {
  return calculateAPY(cohortArgonsInvested.value, cohortArgonsEarned.value);
});

const cohortStartDate = Vue.computed(() => {
  const cohort = stats.dashboard.cohort;
  if (!cohort?.firstTick) {
    return '-----';
  }
  const date = dayjs.utc(cohort.firstTick * 60e3);
  return date.local().format('MMMM D');
});

const cohortEndDate = Vue.computed(() => {
  const cohort = stats.dashboard.cohort;
  if (!cohort?.lastTick) {
    return '-----';
  }
  const date = dayjs.utc(cohort.lastTick * 60e3);
  return date.local().format('MMMM D');
});

const lastBitcoinActivityAt = Vue.computed(() => {
  const lastActivity = stats.bitcoinActivity[0];
  console.log('lastBitcoinActivityAt', lastActivity);
  return lastActivity ? dayjs.utc(lastActivity.insertedAt) : null;
});

const lastArgonActivityAt = Vue.computed(() => {
  const lastActivity = stats.argonActivity[0];
  return lastActivity ? dayjs.utc(lastActivity.insertedAt) : null;
});

const lastBotActivityAt = Vue.computed(() => {
  const lastActivity = stats.botActivity[0];
  return lastActivity ? dayjs.utc(lastActivity.insertedAt) : null;
});

let blocksSubscription: any = null;

Vue.watch(
  () => stats.dashboard.cohort,
  async cohort => {
    if (!cohort) return;
    if (cohort.cohortId === currentCohortId.value) return;

    if (blocksSubscription) {
      await blockchainStore.unsubscribeFromBlocks(blocksSubscription);
      blocksSubscription = null;
    }

    currentCohortId.value = cohort.cohortId;
    const lastBlockNumber = cohort.progress === 100 ? cohort.lastBlockNumber : null;
    const endingFrameId = cohort.cohortId + 10;
    blocks.value = await blockchainStore.fetchBlocks(lastBlockNumber, endingFrameId, 8);

    blocksSubscription = await blockchainStore.subscribeToBlocks(newBlock => {
      if (newBlock.number === blocks.value[0]?.number) return;
      blocks.value.unshift(newBlock);
      if (blocks.value.length > 8) {
        blocks.value.pop();
      }
    });
  },
);

async function goToPreviousCohort() {
  const cohortId = stats.dashboard.cohortId;
  if (!cohortId) return;

  const previousCohortId = Math.max(cohortId - 1, 1);
}

async function goToNextCohort() {
  const cohortId = stats.dashboard.cohortId;
  if (!cohortId) return;

  const nextCohortId = cohortId + 1;
}

function formatLargeNumber(number: number, maxLength = 5) {
  if (number < 10 ** (maxLength - 2)) {
    // 1_000
    return fmtDecimalsMax(number, 2, 2);
  } else if (number < 99 ** (maxLength - 2)) {
    // 99_000
    return fmtCommas(fmtDecimals(number, 0));
  }
  return number;
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
					