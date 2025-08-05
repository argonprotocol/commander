<!-- prettier-ignore -->
<template>
  <div class="flex flex-col h-full">
    <AlertBars />

    <div :class="stats.isLoaded ? '' : 'opacity-30 pointer-events-none'" class="flex flex-col h-full px-2.5 py-2.5 gap-y-2 justify-stretch grow">
      <section class="flex flex-row gap-x-2 h-[14%]">
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>{{ stats.global.totalSeats || 0 }}</span>
          <label>Total Mining Seat{{ stats.global.totalSeats === 1 ? '' : 's' }}</label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>{{ numeral(stats.global.framesMined).format('0,0.[00]') }}</span>
          <label>Frame{{ stats.global.framesMined === 1 ? '' : 's' }} Completed</label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>{{ numeral(stats.global.framesRemaining).format('0,0.[00]') }}</span>
          <label>Frame{{ stats.global.framesRemaining === 1 ? '' : 's' }} Remaining</label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>
            {{ currency.symbol }}{{ microgonToMoneyNm(globalMicrogonsInvested).formatIfElse('< 100', '0.00', '0,0') }}
          </span>
          <label>Relative Total Cost</label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>
            {{ currency.symbol }}{{ microgonToMoneyNm(globalMicrogonsEarned).formatIfElse('< 100', '0.00', '0,0') }}
          </span>
          <label>Relative Total Earnings</label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>{{ numeral(globalAPR).formatIfElseCapped('< 100', '0.[00]', '0,0', 9_999) }}%</span>
          <label>Current APR</label>
        </div>
      </section>

      <section class="flex flex-row gap-x-2.5 grow">
        <div box class="flex flex-col w-[22.5%] px-2">
          <header class="text-[18px] font-bold py-2 text-slate-900/80 border-b border-slate-400/30">
            Asset Breakdown
          </header>
          <ul class="relative flex flex-col items-center whitespace-nowrap w-full h-6/12 mb-4 text-md">
            <li class="flex flex-row items-center justify-between w-full h-[calc(100%/7)] py-2">
              <div>{{ numeral(wallets.miningWallet.availableMicrogons).format('0,0.[00]') }} Argons</div>
              <div>
                {{ currency.symbol
                }}{{ microgonToMoneyNm(wallets.miningWallet.availableMicrogons).format('0,0.00') }}
              </div>
            </li>
            <li class="flex flex-row items-center justify-between w-full h-[calc(100%/7)] border-t border-gray-600/20 border-dashed py-2">
              <div>{{ numeral(wallets.miningWallet.availableMicronots).format('0,0.[00]') }} Argonots</div>
              <div>
                {{ currency.symbol
                }}{{ micronotToMoneyNm(wallets.miningWallet.availableMicronots).format('0,0.00') }}
              </div>
            </li>
            <li class="flex flex-row items-center justify-between w-full h-[calc(100%/7)] border-t border-gray-600/20 border-dashed py-2">
              <div>{{ numeral(wallets.miningWallet.reservedMicronots).format('0,0.[00]') }} Locked Argonots</div>
              <div>
                {{ currency.symbol
                }}{{ micronotToMoneyNm(wallets.miningWallet.reservedMicronots).format('0,0.00') }}
              </div>
            </li>
            <li class="flex flex-row items-center justify-between w-full h-[calc(100%/7)] border-t border-gray-600/20 border-dashed py-2">
              <div>{{ numeral(stats.myMiningBids.bidCount).format('0,0') }} Winning Mining Bids</div>
              <div>
                {{ currency.symbol
                }}{{ microgonToMoneyNm(wallets.miningBidValue).format('0,0.00') }}
              </div>
            </li>
            <li class="flex flex-row items-center justify-between w-full h-[calc(100%/7)] border-t border-gray-600/20 border-dashed py-2">
              <div>{{ numeral(stats.myMiningSeats.seatCount).format('0,0') }} Active Mining Seats</div>
              <div>
                {{ currency.symbol
                }}{{ microgonToMoneyNm(wallets.miningSeatValue).format('0,0.00') }}
              </div>
            </li>
            <li class="flex flex-row items-center justify-between w-full h-[calc(100%/7)] border-t border-gray-600/50 py-2 text-red-900/70">
              <div>Operational Expenses</div>
              <div>
                -{{ currency.symbol
                }}{{ microgonToMoneyNm(stats.myMiningSeats.transactionFees).format('0,0.00') }}
              </div>
            </li>
            <li class="flex flex-row items-center justify-between w-full h-[calc(100%/7)] border-t border-b border-gray-600/50 py-2 font-bold">
              <div>TOTAL VALUE</div>
              <div>
                {{ currency.symbol
                }}{{ microgonToMoneyNm(wallets.totalMiningResources).format('0,0.00') }}
              </div>
            </li>
          </ul>
          <div class="grow flex flex-col items-center justify-end">
            <div @click="openBotOverlay" class="relative text-center mb-5 text-argon-600 opacity-70 hover:opacity-100 cursor-pointer">
              <MinerIcon class="w-20 h-20 mt-5 inline-block mb-1" />
              <div>Configure Mining Bot</div>
            </div>
          </div>
        </div>

        <div class="flex flex-col grow gap-y-2">
          
          <section box class="flex flex-col text-center px-2 h-[15%]">
            <div class="flex flex-row pt-2 pb-1 h-full">
              <div class="flex flex-col w-4/12 items-center justify-center gap-x-2 pb-2 pt-3">
                <div class="font-bold">Bitcoin Node</div>
                <div class="flex flex-row items-center justify-center gap-x-2">
                  <div>Last Block</div>
                  <CountupClock as="span" :time="lastBitcoinActivityAt" v-slot="{ hours, minutes, seconds, isNull }" class="font-mono">
                    <template v-if="hours">{{ hours }}h, </template>
                    <template v-if="minutes">{{ minutes }}m, </template>
                    <template v-if="!isNull">{{ seconds }}s ago</template>
                    <template v-else>-- ----</template>
                  </CountupClock>
                  <BotHistoryOverlayButton :position="'left'">
                    <span class="flex items-center justify-center group border border-transparent hover:border-argon-200 rounded cursor-pointer w-7 h-7 relative top-0.5">
                      <BlocksIcon class="w-4.5 h-4.5 group-hover:text-argon-600" />
                    </span>
                  </BotHistoryOverlayButton>
                </div>
              </div>

              <div class="h-full w-[1px] bg-slate-400/30"></div>
              
              <div class="flex flex-col w-4/12 items-center justify-center gap-x-2 pb-2 pt-3">
                <div class="font-bold">Argon Node</div>
                <div class="flex flex-row items-center justify-center gap-x-2">
                  <div>Last Block</div>
                  <CountupClock as="span" :time="lastArgonActivityAt" v-slot="{ hours, minutes, seconds, isNull }" class="font-mono">
                    <template v-if="hours">{{ hours }}h, </template>
                    <template v-if="minutes">{{ minutes }}m, </template>
                    <template v-if="!isNull">{{ seconds }}s ago</template>
                    <template v-else>-- ----</template>
                  </CountupClock>
                  <BotHistoryOverlayButton :position="'left'">
                    <span class="flex items-center justify-center group border border-transparent hover:border-argon-200 rounded cursor-pointer w-7 h-7 relative top-0.5">
                      <BlocksIcon class="w-4.5 h-4.5 group-hover:text-argon-600" />
                    </span>
                  </BotHistoryOverlayButton>
                </div>
              </div>
              <div class="h-full w-[1px] bg-slate-400/30"></div>
              <div class="flex flex-col w-4/12 items-center justify-center gap-x-2 pb-1 pt-3">
                <div class="font-bold">Mining Bot</div>
                <div class="flex flex-row items-center justify-center gap-x-2">
                  <div>Last Bidding</div>
                  <CountupClock as="span" :time="lastBotActivityAt" v-slot="{ hours, minutes, seconds, isNull }" class="font-mono">
                    <template v-if="hours">{{ hours }}h, </template>
                    <template v-if="minutes">{{ minutes }}m, </template>
                    <template v-if="!isNull">{{ seconds }}s ago</template>
                    <template v-else>-- ----</template>
                  </CountupClock>
                  <ActiveBidsOverlayButton :position="'left'" class="ml-1.5">
                    <span class="flex items-center justify-center group border border-transparent hover:border-argon-200 rounded cursor-pointer w-7 h-7 relative top-0.5">
                      <AuctionIcon class="w-5 h-5 group-hover:text-argon-600" />
                    </span>
                  </ActiveBidsOverlayButton>
                  <BotHistoryOverlayButton :position="'left'">
                    <span class="flex items-center justify-center group border border-transparent hover:border-argon-200 rounded cursor-pointer w-7 h-7 relative top-0.5">
                      <ActivityIcon class="w-5 h-5 group-hover:text-argon-600" />
                    </span>
                  </BotHistoryOverlayButton>
                </div>
              </div>
            </div>
          </section>

          <section box class="flex flex-col grow text-center px-2">
            <header class="flex flex-row justify-between text-xl font-bold py-2 text-slate-900/80 border-b border-slate-400/30">
              <div @click="goToPrevFrame" :class="hasPrevFrame ? 'opacity-60' : 'opacity-20 pointer-events-none'" class="flex flex-row items-center font-light text-base cursor-pointer group hover:opacity-80">
                <ChevronLeftIcon class="w-6 h-6 opacity-50 mx-1 group-hover:opacity-80" />
                PREV
              </div>
              <span class="flex flex-row items-center">
                <span>{{ currentFrameStartDate }} to {{ currentFrameEndDate }}</span>
                <span v-if="stats.selectedFrameId > stats.latestFrameId - 10" class="inline-block rounded-full bg-green-500/80 w-2.5 h-2.5 ml-2"></span>
              </span>
              <div @click="goToNextFrame" :class="hasNextFrame ? 'opacity-60' : 'opacity-20 pointer-events-none'" class="flex flex-row items-center font-light text-base cursor-pointer group hover:opacity-80">
                NEXT
                <ChevronRightIcon class="w-6 h-6 opacity-50 mx-1 group-hover:opacity-80" />
              </div>
            </header>
            <div v-if="currentFrame.activeSeatCount" class="flex flex-row h-full">
              <div class="flex flex-col w-full h-full pt-2 gap-y-2">
                <div class="flex flex-row w-full h-1/2 gap-x-2">
                  
                  <div stat-box class="flex flex-col w-1/3 h-full border-b border-slate-400/30 pb-3">
                    <span>{{ currentFrame.activeSeatCount }}</span>
                    <label>Active Mining Seat{{ currentFrame.activeSeatCount === 1 ? '' : 's' }}</label>
                  </div>

                  <div class="h-full w-[1px] bg-slate-400/30"></div>

                  <div stat-box class="flex flex-col w-1/3 h-full border-b border-slate-400/30 pb-3">
                    <span>{{ currentFrame.blocksMined }}</span>
                    <label class="relative block w-full">
                      Blocks Mined
                      <HealthIndicatorBar />
                    </label>
                  </div>

                  <div class="h-full w-[1px] bg-slate-400/30"></div>

                  <div stat-box class="flex flex-col w-1/3 h-full border-b border-slate-400/30 pb-3">
                    <span>
                      {{
                        microgonToMoneyNm(
                          currentFrame.microgonsMined + currentFrame.microgonsMinted,
                        ).formatIfElse('< 1_000', '0,0.00', '0,0')
                      }}
                    </span>
                    <label class="relative block w-full">
                      Argons Collected
                      <HealthIndicatorBar />
                    </label>
                  </div>

                  <div class="h-full w-[1px] bg-slate-400/30"></div>
                  
                  <div stat-box class="flex flex-col w-1/3 h-full border-b border-slate-400/30 pb-3">
                    <span>
                      {{
                        microgonToMoneyNm(currentFrame.micronotsMined).formatIfElse('< 1_000', '0,0.00', '0,0')
                      }}
                    </span>
                    <label class="relative block w-full">
                      Argonots Collected
                      <HealthIndicatorBar />
                    </label>
                  </div>

                </div>

                <div class="flex flex-row w-full h-1/2 gap-x-2">
                  
                  <div stat-box class="flex flex-col w-1/3 h-full">
                    <div class="relative size-28">
                      <svg class="size-full -rotate-90" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="18" cy="18" r="16" fill="none" class="stroke-current text-gray-200 dark:text-neutral-700" stroke-width="3"></circle>
                        <circle cx="18" cy="18" r="16" fill="none" class="stroke-current text-argon-600 dark:text-argon-500" stroke-width="3" stroke-dasharray="100" :stroke-dashoffset="100-currentFrame.progress" stroke-linecap="butt"></circle>
                      </svg>

                      <div class="absolute top-1/2 start-1/2 transform -translate-y-1/2 -translate-x-1/2">
                        <span class="text-center text-2xl font-bold text-argon-600 dark:text-argon-500">{{ Math.round(currentFrame.progress) }}%</span>
                      </div>
                    </div>
                  </div>

                  <div class="h-full w-[1px] bg-slate-400/30"></div>

                  <div stat-box class="flex flex-col w-1/3 h-full pb-3">
                    <span>
                      {{ currency.symbol
                      }}{{ microgonToMoneyNm(currentFrameCost).formatIfElse('< 1_000', '0,0.00', '0,0') }}
                    </span>
                    <label>Relative Frame Cost</label>
                  </div>
                  
                  <div class="h-full w-[1px] bg-slate-400/30"></div>
                  
                  <div stat-box class="flex flex-col w-1/3 h-full pb-3">
                    <span>
                      {{ currency.symbol
                      }}{{ microgonToMoneyNm(currentFrameEarnings).formatIfElse('< 1_000', '0,0.00', '0,0') }}
                    </span>
                    <label class="relative block w-full">
                      Relative Frame Earnings
                      <HealthIndicatorBar />
                    </label>
                  </div>
                  
                  <div class="h-full w-[1px] bg-slate-400/30"></div>
                  
                  <div stat-box class="flex flex-col w-1/3 h-full pb-3">
                    <span>{{ numeral(currentFrameProfit).formatIfElseCapped('< 100', '0.[00]', '0,0', 9_999) }}%</span>
                    <label class="relative block w-full">
                      Current Frame Profit
                      <HealthIndicatorBar />
                    </label>
                  </div>

                </div>
              </div>
            </div>
            <div v-else-if="currentFrame.id === stats.latestFrameId" class="flex flex-col items-center justify-center h-full text-slate-900/20 text-2xl font-bold">
              You Have No Mining Seats
            </div>
            <div v-else class="flex flex-col items-center justify-center h-full text-slate-900/20 text-2xl font-bold">
              You Had No Mining Seats During This Frame
            </div>
          </section>

          <section box class="relative flex flex-col h-[35%] min-h-32 !pb-0.5 px-2">
            <Chart ref="chartRef" />
            <NibSlider ref="nibSliderRef" position="right" :pos="sliderLeftPosX" :isActive="false" @pointerdown="startDrag($event)" @pointermove="onDrag($event)" @pointerup="stopDrag($event)" />
          </section>
        </div>
      </section>
    </div>
  </div>
</template>

<script lang="ts">
import type { IBlock } from '../../stores/blockchain';
import { IDashboardFrameStats } from '../../interfaces/IStats.ts';

const blocks = Vue.ref<IBlock[]>([]);
</script>

<script setup lang="ts">
import * as Vue from 'vue';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import { BigNumber } from 'bignumber.js';
import { calculateAPR } from '../../lib/Utils';
import { useStats } from '../../stores/stats';
import { useCurrency } from '../../stores/currency';
import { useBot } from '../../stores/bot';
import { useBlockchainStore } from '../../stores/blockchain';
import basicEmitter from '../../emitters/basicEmitter';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/24/outline';
import CountupClock from '../../components/CountupClock.vue';
import AlertBars from '../../components/AlertBars.vue';
import numeral, { createNumeralHelpers } from '../../lib/numeral';
import { bigNumberToBigInt, MiningFrames } from '@argonprotocol/commander-calculator';
import AuctionIcon from '../../assets/auction.svg?component';
import ActivityIcon from '../../assets/activity.svg?component';
import BlocksIcon from '../../assets/blocks.svg?component';
import ActiveBidsOverlayButton from '../../overlays/ActiveBidsOverlayButton.vue';
import BotHistoryOverlayButton from '../../overlays/BotHistoryOverlayButton.vue';
import { getMainchainClient } from '../../stores/mainchain';
import { Accountset, Keyring } from '@argonprotocol/mainchain';
import { useConfig } from '../../stores/config';
import { TICK_MILLIS } from '../../lib/Config.ts';
import { useWallets } from '../../stores/wallets';
import MinerIcon from '../../assets/miner.svg?component';
import HealthIndicatorBar from '../../components/HealthIndicatorBar.vue';
import Chart from '../../components/Chart.vue';
import NibSlider from '../../components/NibSlider.vue';

dayjs.extend(relativeTime);
dayjs.extend(utc);

const bot = useBot();
const stats = useStats();
const config = useConfig();
const currency = useCurrency();
const clientPromise = getMainchainClient();
const blockchainStore = useBlockchainStore();
const wallets = useWallets();

const { microgonToMoneyNm, micronotToMoneyNm } = createNumeralHelpers(currency);

const isDragging = Vue.ref(false);

let dragMeta: any = {};

const chartRef = Vue.ref<InstanceType<typeof Chart> | null>(null);
const nibSliderRef = Vue.ref<InstanceType<typeof NibSlider> | null>(null);

const currentFrame = Vue.ref<IDashboardFrameStats>({
  id: 0,
  date: '',
  firstTick: 0,
  lastTick: 0,
  activeSeatCount: 0,
  relativeSeatCost: 0n,
  microgonToUsd: [0n],
  microgonToArgonot: [0n],
  blocksMined: 0,

  micronotsMined: 0n,
  microgonsMined: 0n,
  microgonsMinted: 0n,
  microgonValueOfRewards: 0n,

  progress: 0,
  profit: 0,
  profitPct: 0,
  score: 0,
});

const currentCohortId = Vue.ref(0);

const walletMiningJson = JSON.parse(config.security.walletJson);
const walletMiningAccount = new Keyring().createFromJson(walletMiningJson);
walletMiningAccount.decodePkcs8(''); // TODO: Need to use passphrase when feature is added
const accountset = new Accountset({
  client: clientPromise,
  seedAccount: walletMiningAccount,
  sessionKeyMnemonic: config.security.sessionMnemonic,
  subaccountRange: new Array(99).fill(0).map((_, i) => i),
});

const globalMicrogonsEarned = Vue.computed(() => {
  const { totalMicrogonsMined, totalMicrogonsMinted, totalMicronotsMined } = stats.global;
  return totalMicrogonsMined + totalMicrogonsMinted + currency.micronotToMicrogon(totalMicronotsMined);
});

const globalMicrogonsInvested = Vue.computed(() => {
  return stats.global.framedCost;
});

const globalAPR = Vue.computed(() => {
  return calculateAPR(globalMicrogonsInvested.value, globalMicrogonsEarned.value);
});

const currentFrameEarnings = Vue.computed(() => {
  if (!currentFrame.value.activeSeatCount) return 0n;

  const { microgonsMined, microgonsMinted, micronotsMined } = currentFrame.value;
  const microgons = microgonsMined + microgonsMinted;
  return microgons + currency.micronotToMicrogon(micronotsMined);
});

const currentFrameCost = Vue.computed(() => {
  if (!currentFrame.value.activeSeatCount) return 0n;
  return currentFrame.value.relativeSeatCost;
});

const currentFrameProfit = Vue.computed(() => {
  const earningsBn = BigNumber(currentFrameEarnings.value);
  const costBn = BigNumber(currentFrameCost.value);
  const profitBn = earningsBn.minus(costBn).dividedBy(costBn).multipliedBy(100);
  return profitBn.toNumber();
});

const currentFrameStartDate = Vue.computed(() => {
  if (!currentFrame.value.firstTick) {
    return '-----';
  }
  const date = dayjs.utc(currentFrame.value.firstTick * TICK_MILLIS);
  return date.local().format('MMMM D, h:mm A');
});

const currentFrameEndDate = Vue.computed(() => {
  if (!currentFrame.value.lastTick) {
    return '-----';
  }
  const date = dayjs.utc(currentFrame.value.lastTick * TICK_MILLIS);
  return date.local().add(1, 'minute').format('MMMM D, h:mm A');
});

const lastBitcoinActivityAt = Vue.computed(() => {
  const lastActivity = stats.bitcoinActivity[0];
  return lastActivity ? dayjs.utc(lastActivity.insertedAt) : null;
});

const lastArgonActivityAt = Vue.computed(() => {
  const lastActivity = stats.argonActivity[0];
  return lastActivity ? dayjs.utc(lastActivity.insertedAt) : null;
});

const lastBotActivityAt = Vue.computed(() => {
  const lastActivity = stats.biddingActivity[0];
  return lastActivity ? dayjs.utc(lastActivity.insertedAt) : null;
});

const hasNextFrame = Vue.computed(() => {
  return sliderFrameIndex.value < stats.frames.length - 1;
});

const hasPrevFrame = Vue.computed(() => {
  return sliderFrameIndex.value > 0;
});

async function goToPrevFrame() {
  const newFrameIndex = Math.max(sliderFrameIndex.value - 1, 0);
  updateFrameSliderPos(newFrameIndex);
}

async function goToNextFrame() {
  const newFrameIndex = Math.min(sliderFrameIndex.value + 1, stats.frames.length - 1);
  updateFrameSliderPos(newFrameIndex);
}

function openBotOverlay() {
  basicEmitter.emit('openBotOverlay');
}

function loadChartData() {
  const items: any[] = [];
  for (const [index, frame] of stats.frames.entries()) {
    const item = {
      date: frame.date,
      score: frame.score,
      isFiller: frame.activeSeatCount === 0,
      previous: items[index - 1],
      next: undefined,
    };
    items.push(item);
  }

  for (const [index, item] of items.entries()) {
    item.next = items[index + 1];
  }

  chartRef.value?.reloadData(items);
  updateFrameSliderPos(items.length - 1);
}

const sliderFrameIndex = Vue.ref(0);
const sliderLeftPosX = Vue.ref(0);

function startDrag(event: PointerEvent) {
  const elementLeftPos = sliderLeftPosX.value; // TODO: This is not correct
  const cursor = window.getComputedStyle(event.target as Element).cursor;
  const startX = event.clientX;

  isDragging.value = true;
  dragMeta = {
    startX,
    elemOffset: elementLeftPos - startX,
    elemLeftPos: elementLeftPos,
    startIndex: sliderFrameIndex.value,
    hasShiftKey: event.metaKey || event.shiftKey,
  };

  if (cursor === 'grab') {
    document.body.classList.add('isGrabbing');
  } else if (cursor === 'col-resize') {
    document.body.classList.add('isResizing');
  }
}

function onDrag(event: PointerEvent) {
  if (!isDragging.value) return;

  const rawX = event.clientX;
  const currentX = rawX + dragMeta.elemOffset;
  const currentIndex = chartRef.value?.getItemIndexFromEvent(event, { x: currentX });

  dragMeta.wasDragged = dragMeta.wasDragged || currentIndex !== dragMeta.startIndex;

  updateFrameSliderPos(currentIndex || 0, true);
}

function stopDrag(event: PointerEvent) {
  isDragging.value = false;

  const rawX = event.clientX;
  const currentX = rawX + dragMeta.elemOffset;
  const currentIndex = chartRef.value?.getItemIndexFromEvent(event, { x: currentX });

  updateFrameSliderPos(currentIndex || 0, true);

  document.body.classList.remove('isGrabbing');
  document.body.classList.remove('isResizing');
}

function updateFrameSliderPos(index: number, wasManuallyMoved: boolean = false) {
  index = Math.max(index || 0, 0);
  sliderFrameIndex.value = index;

  const item = stats.frames[index];
  const pointPosition = chartRef.value?.getPointPosition(index);

  currentFrame.value = item;
  sliderLeftPosX.value = pointPosition?.x || 0;
}

Vue.watch(
  () => stats.frames,
  () => loadChartData(),
);

Vue.onMounted(() => {
  stats.subscribeToDashboard();
  stats.subscribeToActivity();
});

Vue.onUnmounted(() => {
  stats.unsubscribeFromDashboard();
  stats.unsubscribeFromActivity();
});
</script>

<style scoped>
@reference "../../main.css";

[box] {
  @apply bg-white rounded shadow min-h-20 border-[1px] border-slate-400/30 py-2;
}

[stat-box] {
  @apply flex flex-col items-center justify-center text-argon-600;
  span {
    @apply text-3xl font-bold;
  }
  label {
    @apply text-sm text-gray-500 mt-1;
  }
}
</style>
