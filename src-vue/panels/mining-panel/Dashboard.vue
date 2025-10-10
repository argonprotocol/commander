<!-- prettier-ignore -->
<template>
  <div data-testid="Dashboard" class="flex flex-col h-full">
    <div :class="stats.isLoaded ? '' : 'opacity-30 pointer-events-none'" class="flex flex-col h-full px-2.5 py-2.5 gap-y-2 justify-stretch grow">
      <section class="flex flex-row gap-x-2 h-[14%]">
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>{{ stats.global.seatsTotal || 0 }}</span>
          <label>Total Mining Seat{{ stats.global.seatsTotal === 1 ? '' : 's' }}</label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>{{ numeral(stats.global.framesCompleted).format('0,0.[00]') }}</span>
          <label>Frame{{ stats.global.framesCompleted === 1 ? '' : 's' }} Completed</label>
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
          <span>{{ numeral(globalAPY).formatIfElseCapped('< 100', '0.[00]', '0,0', 9_999) }}%</span>
          <label>Current APY</label>
        </div>
      </section>

      <section class="flex flex-row gap-x-2.5 grow">
        <div box class="flex flex-col w-[22.5%] px-2">
          <header class="text-[18px] font-bold py-2 text-slate-900/80 border-b border-slate-400/30">
            Asset Breakdown
          </header>
          <ul class="relative flex flex-col items-center whitespace-nowrap w-full min-h-6/12 mb-4 text-md">
            <li class="flex flex-col w-full min-h-[calc(100%/7)] pt-2 pb-4">
              <div class="flex flex-row items-center w-full">
                <ArgonIcon class="w-7 h-7 text-argon-600/70 mr-2" />
                <div class="grow">Unused Argons</div>
                <div class="pr-1">
                  {{ currency.symbol
                  }}{{ microgonToMoneyNm(wallets.miningWallet.availableMicrogons).format('0,0.00') }}
                </div>
              </div>
              <div class="flex flex-col ml-9 gap-y-1 text-slate-900/60 pb-3">
                <div class="border-t border-gray-600/20 border-dashed pt-2 relative">
                  <ArrowTurnDownRightIcon class="w-5 h-5 text-slate-600/40 absolute top-1/2 -translate-y-1/2 -translate-x-[130%] left-0" />
                  0 Waiting to Use
                </div>
                <div class="border-t border-gray-600/20 border-dashed pt-2 relative">
                  <ArrowTurnDownRightIcon class="w-5 h-5 text-slate-600/40 absolute top-1/2 -translate-y-1/2 -translate-x-[130%] left-0" />
                  {{microgonToArgonNm(wallets.miningWallet.availableMicrogons).format('0,0.[00]')}} Not Allocated
                </div>
              </div>
            </li>
            <li class="flex flex-col w-full min-h-[calc(100%/7)] border-t border-gray-600/20 border-dashed py-2">
              <div class="flex flex-row items-center w-full">
                <ArgonotIcon class="w-7 h-7 text-argon-600/70 mr-2" />
                <div class="grow">Unused Argonots</div>
                <div class="pr-1">
                  {{ currency.symbol
                  }}{{ micronotToMoneyNm(wallets.miningWallet.availableMicronots).format('0,0.00') }}
                </div>
              </div>
              <div class="flex flex-col ml-9 gap-y-1 text-slate-900/60 pb-6">
                <div class="border-t border-gray-600/20 border-dashed pt-2 relative">
                  <ArrowTurnDownRightIcon class="w-5 h-5 text-slate-600/40 absolute top-1/2 -translate-y-1/2 -translate-x-[130%] left-0" />
                  0 Waiting to Use
                </div>
                <div class="border-t border-gray-600/20 border-dashed pt-2 relative">
                  <ArrowTurnDownRightIcon class="w-5 h-5 text-slate-600/40 absolute top-1/2 -translate-y-1/2 -translate-x-[130%] left-0" />
                  {{microgonToArgonNm(wallets.miningWallet.availableMicronots).format('0,0.[00]')}} Not Allocated
                </div>
              </div>
            </li>
            <!-- <li class="flex flex-row items-center w-full h-[calc(100%/7)] border-t border-gray-600/20 border-dashed py-2">
              <ArgonotLockedIcon class="w-7 h-7 text-argon-600/70 mr-2" />
              <div class="grow">Locked Argonots</div>
              <div class="pr-1">
                {{ currency.symbol
                }}{{ micronotToMoneyNm(wallets.miningWallet.reservedMicronots).format('0,0.00') }}
              </div>
            </li> -->
            <li class="flex flex-row items-center w-full h-[calc(100%/7)] border-t border-gray-600/20 border-dashed py-2">
              <MiningBidIcon class="w-7 h-7 text-argon-600/70 mr-2" />
              <div class="grow">Winning <span class="hidden 2xl:inline">Mining</span> Bids ({{ numeral(stats.myMiningBids.bidCount).format('0,0') }})</div>
              <div class="pr-1">
                {{ currency.symbol
                }}{{ microgonToMoneyNm(wallets.miningBidValue).format('0,0.00') }}
              </div>
            </li>
            <li class="flex flex-row items-center w-full h-[calc(100%/7)] border-t border-gray-600/20 border-dashed py-2">
              <MiningSeatIcon class="w-7 h-7 text-argon-600/70 mr-2" />
              <div class="grow">Active <span class="hidden 2xl:inline">Mining</span> Seats ({{ numeral(stats.myMiningSeats.seatCount).format('0,0') }})</div>
              <div class="pr-1">
                {{ currency.symbol
                }}{{ microgonToMoneyNm(wallets.miningSeatValue).format('0,0.00') }}
              </div>
            </li>
            <li class="flex flex-row items-center w-full h-[calc(100%/7)] border-t border-gray-600/40 py-2 text-red-900/70">
              <div class="grow pl-1"><span class="hidden 2xl:inline">Operational</span> Expenses</div>
              <div class="pr-1">
                -{{ currency.symbol
                }}{{ microgonToMoneyNm(stats.myMiningSeats.transactionFeesTotal).format('0,0.00') }}
              </div>
            </li>
            <li class="flex flex-row items-center justify-between w-full h-[calc(100%/7)] border-t border-b border-gray-600/40 py-2 font-bold">
              <div class="grow pl-1">Total Value</div>
              <div class="pr-1">
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
                <div class="flex flex-row items-center justify-center gap-x-2 whitespace-nowrap">
                  <div>Last Block</div>
                  <CountupClock as="span" :time="lastBitcoinActivityAt" v-slot="{ hours, minutes, seconds, isNull }" class="font-mono">
                    <template v-if="hours">{{ hours }}h, </template>
                    <template v-if="minutes || hours">{{ minutes }}m{{ !isNull && !hours ? ', ' : '' }}</template>
                    <template v-if="!isNull && !hours">{{ seconds }}s ago</template>
                    <template v-else-if="isNull">-- ----</template>
                  </CountupClock>
                  <BitcoinBlocksOverlay :position="'right'">
                    <span class="flex items-center justify-center group border border-transparent hover:border-argon-200 rounded cursor-pointer w-7 h-7 relative top-0.5">
                      <BlocksIcon class="w-4.5 h-4.5 group-hover:text-argon-600" />
                    </span>
                  </BitcoinBlocksOverlay>
                </div>
              </div>

              <div class="h-full w-[1px] bg-slate-400/30"></div>

              <div class="flex flex-col w-4/12 items-center justify-center gap-x-2 pb-2 pt-3">
                <div class="font-bold">Argon Node</div>
                <div class="flex flex-row items-center justify-center gap-x-2 whitespace-nowrap">
                  <div>Last Block</div>
                  <CountupClock as="span" :time="lastArgonActivityAt" v-slot="{ hours, minutes, seconds, isNull }" class="font-mono">
                    <template v-if="hours">{{ hours }}h, </template>
                    <template v-if="minutes || hours">{{ minutes }}m{{ !isNull && !hours ? ', ' : '' }}</template>
                    <template v-if="!isNull && !hours">{{ seconds }}s ago</template>
                    <template v-else-if="isNull">-- ----</template>
                  </CountupClock>
                  <ArgonBlocksOverlay :position="'left'">
                    <span class="flex items-center justify-center group border border-transparent hover:border-argon-200 rounded cursor-pointer w-7 h-7 relative top-0.5">
                      <BlocksIcon class="w-4.5 h-4.5 group-hover:text-argon-600" />
                    </span>
                  </ArgonBlocksOverlay>
                </div>
              </div>
              <div class="h-full w-[1px] bg-slate-400/30"></div>
              <div class="flex flex-col w-4/12 items-center justify-center gap-x-2 pb-1 pt-3">
                <div class="font-bold">Mining Bot</div>
                <div class="flex flex-row items-center justify-center gap-x-2 whitespace-nowrap">
                  <div>Last Active</div>
                  <CountupClock as="span" :time="botActivityLastUpdatedAt" v-slot="{ hours, minutes, seconds, isNull }" class="font-mono">
                    <template v-if="hours">{{ hours }}h, </template>
                    <template v-if="minutes || hours">{{ minutes }}m{{ !isNull && !hours ? ', ' : '' }}</template>
                    <template v-if="!isNull && !hours">{{ seconds }}s ago</template>
                    <template v-else-if="isNull">-- ----</template>
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
              <span class="flex flex-row items-center" :title="'Frame #' + currentFrame.id">
                <span>{{ currentFrameStartDate }} to {{ currentFrameEndDate }}</span>
                <span v-if="stats.selectedFrameId > stats.latestFrameId - 10" class="inline-block rounded-full bg-green-500/80 w-2.5 h-2.5 ml-2"></span>
              </span>
              <div @click="goToNextFrame" :class="hasNextFrame ? 'opacity-60' : 'opacity-20 pointer-events-none'" class="flex flex-row items-center font-light text-base cursor-pointer group hover:opacity-80">
                NEXT
                <ChevronRightIcon class="w-6 h-6 opacity-50 mx-1 group-hover:opacity-80" />
              </div>
            </header>
            <div v-if="currentFrame.seatCountActive" class="flex flex-row h-full">
              <div class="flex flex-col w-full h-full pt-2 gap-y-2">
                <div class="flex flex-row w-full h-1/2 gap-x-2">

                  <div stat-box class="flex flex-col w-1/3 h-full border-b border-slate-400/30 pb-3">
                    <span>{{ currentFrame.seatCountActive }}</span>
                    <label class="relative block w-full">
                      Active Mining Seat{{ currentFrame.seatCountActive === 1 ? '' : 's' }}
                      <p class="absolute -bottom-4 uppercase h-[10px] text-center w-full text-xs text-gray-400">Out of {{ currentFrame.allMinersCount }} in network</p>
                    </label>
                  </div>

                  <div class="h-full w-[1px] bg-slate-400/30"></div>

                  <div stat-box class="flex flex-col w-1/3 h-full border-b border-slate-400/30 pb-3">
                    <span data-testid="TotalBlocksMined" :data-value=" currentFrame.blocksMinedTotal">{{ numeral(currentFrame.blocksMinedTotal).format('0,0') }}</span>
                    <label class="relative block w-full" :title="'Expected Mined Blocks: ' + currentFrame.expected.blocksMinedTotal">
                      Blocks Mined
                      <HealthIndicatorBar :percent="getPercent(currentFrame.blocksMinedTotal, currentFrame.expected.blocksMinedTotal)" />
                    </label>
                  </div>

                  <div class="h-full w-[1px] bg-slate-400/30"></div>

                  <div stat-box class="flex flex-col w-1/3 h-full border-b border-slate-400/30 pb-3">
                    <span>
                      {{
                        microgonToMoneyNm(
                          currentFrame.microgonsMinedTotal + currentFrame.microgonsMintedTotal,
                        ).formatIfElse('< 1_000', '0,0.00', '0,0')
                      }}
                    </span>
                    <label class="relative block w-full" :title="'Expected Argons Mined: ' + microgonToMoneyNm(currentFrame.expected.microgonsMinedTotal).format('0,0.00') + ', Minted: ' + microgonToMoneyNm(currentFrame.expected.microgonsMintedTotal).format('0,0.00')">
                      Argons Collected
                      <HealthIndicatorBar :percent="getPercent(currentFrame.microgonsMinedTotal + currentFrame.microgonsMintedTotal, currentFrame.expected.microgonsMinedTotal + currentFrame.expected.microgonsMintedTotal)" />
                    </label>
                  </div>

                  <div class="h-full w-[1px] bg-slate-400/30"></div>

                  <div stat-box class="flex flex-col w-1/3 h-full border-b border-slate-400/30 pb-3">
                    <span>
                      {{
                        microgonToMoneyNm(currentFrame.micronotsMinedTotal).formatIfElse('< 1_000', '0,0.00', '0,0')
                      }}
                    </span>
                    <label class="relative block w-full" :title="'Expected Argonots Collected ' + micronotToMoneyNm(currentFrame.expected.micronotsMinedTotal).format('0,0.00')">
                      Argonots Collected
                      <HealthIndicatorBar :percent="getPercent(currentFrame.micronotsMinedTotal, currentFrame.expected.micronotsMinedTotal)" />
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
                    <label>{{ currentFrame.progress < 100 ? 'Relative' : '' }} Frame Cost</label>
                  </div>

                  <div class="h-full w-[1px] bg-slate-400/30"></div>

                  <div stat-box class="flex flex-col w-1/3 h-full pb-3">
                    <span>
                      {{ currency.symbol
                      }}{{ microgonToMoneyNm(currentFrameEarnings).formatIfElse('< 1_000', '0,0.00', '0,0') }}
                    </span>
                    <label class="relative block w-full" :title="'Expected Earnings: ' + microgonToMoneyNm(expectedFrameEarnings).format('0,0.00')">
                      {{ currentFrame.progress < 100 ? 'Relative' : '' }} Frame Earnings
                      <HealthIndicatorBar :percent="getPercent(currentFrameEarnings, expectedFrameEarnings)" />
                    </label>
                  </div>

                  <div class="h-full w-[1px] bg-slate-400/30"></div>

                  <div stat-box class="flex flex-col w-1/3 h-full pb-3">
                    <span>{{ numeral(currentFrameProfit).formatIfElseCapped('< 100', '0.[00]', '0,0', 9_999) }}%</span>
                    <label class="relative block w-full" :title="'Expected Profit: ' + numeral(expectedFrameProfit).formatIfElseCapped('< 100', '0.[00]', '0,0', 9_999) + '%'">
                      {{ currentFrame.progress < 100 ? 'Current' : '' }} Frame Profit
                      <HealthIndicatorBar :percent="getPercent(currentFrameProfit, expectedFrameProfit)" />
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
            <FrameSlider ref="frameSliderRef" :chartItems="chartItems" @changedFrame="updateSliderFrame" />
          </section>
        </div>
      </section>
    </div>
  </div>
</template>

<script lang="ts">
import * as Vue from 'vue';
import { IDashboardFrameStats } from '../../interfaces/IStats.ts';
import dayjs from 'dayjs';
import { ArrowTurnDownRightIcon } from '@heroicons/vue/24/outline';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';

// storing refs outside of setup to avoid re-creation on each setup call and speed ui load
const currentFrame = Vue.ref<IDashboardFrameStats>({
  id: 0,
  date: '',
  firstTick: 0,
  lastTick: 0,
  allMinersCount: 0,
  seatCountActive: 0,
  seatCostTotalFramed: 0n,
  microgonToUsd: [0n],
  microgonToArgonot: [0n],
  blocksMinedTotal: 0,

  micronotsMinedTotal: 0n,
  microgonsMinedTotal: 0n,
  microgonsMintedTotal: 0n,
  microgonFeesCollectedTotal: 0n,
  microgonValueOfRewards: 0n,

  progress: 0,
  profit: 0,
  profitPct: 0,
  score: 0,

  expected: {
    blocksMinedTotal: 0,
    micronotsMinedTotal: 0n,
    microgonsMinedTotal: 0n,
    microgonsMintedTotal: 0n,
  },
});
const sliderFrameIndex = Vue.ref(0);

dayjs.extend(relativeTime);
dayjs.extend(utc);
</script>

<script setup lang="ts">
import { BigNumber } from 'bignumber.js';
import { calculateAPY } from '../../lib/Utils';
import { useStats } from '../../stores/stats';
import { useCurrency } from '../../stores/currency';
import basicEmitter from '../../emitters/basicEmitter';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/24/outline';
import CountupClock from '../../components/CountupClock.vue';
import numeral, { createNumeralHelpers } from '../../lib/numeral';
import AuctionIcon from '../../assets/auction.svg?component';
import ActivityIcon from '../../assets/activity.svg?component';
import BlocksIcon from '../../assets/blocks.svg?component';
import ActiveBidsOverlayButton from '../../overlays/ActiveBidsOverlayButton.vue';
import BotHistoryOverlayButton from '../../overlays/BotHistoryOverlayButton.vue';
import { TICK_MILLIS } from '../../lib/Env.ts';
import { useWallets } from '../../stores/wallets';
import MinerIcon from '../../assets/miner.svg?component';
import HealthIndicatorBar from '../../components/HealthIndicatorBar.vue';
import ArgonIcon from '../../assets/resources/argon.svg?component';
import ArgonotIcon from '../../assets/resources/argonot.svg?component';
import ArgonotLockedIcon from '../../assets/resources/argonot-locked.svg?component';
import MiningBidIcon from '../../assets/resources/mining-bid.svg?component';
import MiningSeatIcon from '../../assets/resources/mining-seat.svg?component';
import ArgonBlocksOverlay from '../../overlays/ArgonBlocksOverlay.vue';
import BitcoinBlocksOverlay from '../../overlays/BitcoinBlocksOverlay.vue';
import FrameSlider from '../../components/FrameSlider.vue';
import { IChartItem } from '../../components/FrameSlider.vue';

const stats = useStats();
const currency = useCurrency();

const wallets = useWallets();

const frameSliderRef = Vue.ref<InstanceType<typeof FrameSlider> | null>(null);
const chartItems = Vue.ref<IChartItem[]>([]);

function getPercent(value: bigint | number, total: bigint | number): number {
  if (total === 0n || total === 0) return 0;
  return BigNumber(value).dividedBy(total).multipliedBy(100).toNumber();
}

const { microgonToMoneyNm, micronotToMoneyNm, microgonToArgonNm } = createNumeralHelpers(currency);

const globalMicrogonsEarned = Vue.computed(() => {
  const {
    microgonsMinedTotal: totalMicrogonsMined,
    microgonsMintedTotal: totalMicrogonsMinted,
    micronotsMinedTotal: totalMicronotsMined,
  } = stats.global;
  return totalMicrogonsMined + totalMicrogonsMinted + currency.micronotToMicrogon(totalMicronotsMined);
});

const globalMicrogonsInvested = Vue.computed(() => {
  return stats.global.framedCost;
});

const globalAPY = Vue.computed(() => {
  return calculateAPY(globalMicrogonsInvested.value, globalMicrogonsEarned.value);
});

const currentFrameEarnings = Vue.computed(() => {
  if (!currentFrame.value.seatCountActive) return 0n;

  const { microgonsMinedTotal, microgonsMintedTotal, micronotsMinedTotal } = currentFrame.value;
  const microgons = microgonsMinedTotal + microgonsMintedTotal;
  return microgons + currency.micronotToMicrogon(micronotsMinedTotal);
});

const expectedFrameEarnings = Vue.computed(() => {
  if (!currentFrame.value.seatCountActive) return 0n;

  const { expected } = currentFrame.value;
  const microgons = expected.microgonsMinedTotal + expected.microgonsMintedTotal;
  return microgons + currency.micronotToMicrogon(expected.micronotsMinedTotal);
});

const currentFrameCost = Vue.computed(() => {
  if (!currentFrame.value.seatCountActive) return 0n;
  return currentFrame.value.seatCostTotalFramed;
});

const currentFrameProfit = Vue.computed(() => {
  const earningsBn = BigNumber(currentFrameEarnings.value);
  const costBn = BigNumber(currentFrameCost.value);
  const profitBn = earningsBn.minus(costBn).dividedBy(costBn).multipliedBy(100);
  return profitBn.toNumber();
});

const expectedFrameProfit = Vue.computed(() => {
  const earningsBn = BigNumber(expectedFrameEarnings.value);
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
  const lastActivity = stats.serverState.bitcoinBlocksLastUpdatedAt;
  return lastActivity ? dayjs.utc(lastActivity).local() : null;
});

const lastArgonActivityAt = Vue.computed(() => {
  const lastActivity = stats.serverState.argonBlocksLastUpdatedAt;
  return lastActivity ? dayjs.utc(lastActivity).local() : null;
});

const botActivityLastUpdatedAt = Vue.computed(() => {
  const lastActivity = stats.serverState.botActivityLastUpdatedAt;
  return lastActivity ? dayjs.utc(lastActivity).local() : null;
});

const hasNextFrame = Vue.computed(() => {
  return sliderFrameIndex.value < stats.frames.length - 1;
});

const hasPrevFrame = Vue.computed(() => {
  return sliderFrameIndex.value > 0;
});

function goToPrevFrame() {
  frameSliderRef.value?.goToPrevFrame();
}

function goToNextFrame() {
  frameSliderRef.value?.goToNextFrame();
}

function openBotOverlay() {
  basicEmitter.emit('openBotOverlay');
}

function loadChartData() {
  let isFiller = true;
  const items: any[] = [];
  for (const [index, frame] of stats.frames.entries()) {
    if (isFiller && frame.seatCountActive > 0) {
      const previousItem = items[index - 1];
      previousItem && (previousItem.isFiller = false);
      isFiller = false;
    }
    const item = {
      date: frame.date,
      score: frame.score,
      isFiller,
      previous: items[index - 1],
      next: undefined,
    };
    items.push(item);
  }

  for (const [index, item] of items.entries()) {
    item.next = items[index + 1];
  }

  chartItems.value = items;
}

function updateSliderFrame(newFrameIndex: number) {
  sliderFrameIndex.value = newFrameIndex;
  currentFrame.value = stats.frames[newFrameIndex];
}

Vue.watch(
  () => stats.frames,
  () => loadChartData(),
);

Vue.onMounted(() => {
  stats.subscribeToDashboard();
  stats.subscribeToActivity();
  loadChartData();
});

Vue.onUnmounted(() => {
  stats.unsubscribeFromDashboard();
  stats.unsubscribeFromActivity();
});
</script>

<style scoped>
@reference "../../main.css";

[box] {
  @apply min-h-20 rounded border-[1px] border-slate-400/30 bg-white py-2 shadow;
}

[stat-box] {
  @apply text-argon-600 flex flex-col items-center justify-center;
  span {
    @apply text-3xl font-bold;
  }
  label {
    @apply mt-1 text-sm text-gray-500;
  }
}
</style>
