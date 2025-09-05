<!-- prettier-ignore -->
<template>
  <DialogRoot class="absolute inset-0 z-10" :open="isOpen">
    <DialogPortal>
      <DialogOverlay asChild>
        <BgOverlay @close="cancelOverlay" />
      </DialogOverlay>

      <DialogContent @escapeKeyDown="cancelOverlay" :aria-describedby="undefined">
        <EditBoxOverlay
          :id="editBoxOverlayId"
          :position="editBoxOverlayPosition"
          v-if="editBoxOverlayId"
          @close="editBoxOverlayId = null"
          @update:data="updateAPYs"
        />
        <div
          ref="dialogPanel"
          class="BotOverlay absolute top-[40px] left-3 right-3 bottom-3 flex flex-col rounded-md border border-black/30 inner-input-shadow bg-argon-menu-bg text-left z-20 transition-all focus:outline-none"
          style="box-shadow: 0px -1px 2px 0 rgba(0, 0, 0, 0.1), inset 0 2px 0 rgba(255, 255, 255, 1);">
          <BgOverlay v-if="editBoxOverlayId" @close="editBoxOverlayId = null" :showWindowControls="false" rounded="md" class="z-100" />
          <div class="flex flex-col h-full w-full">
            <h2
              class="relative text-3xl font-bold text-left border-b border-slate-300 pt-5 pb-4 pl-3 mx-4 text-[#672D73]"
              style="box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1)"
            >
              <DialogTitle as="div" class="relative z-10">Configure Your Mining Bot</DialogTitle>
              <div @click="cancelOverlay" class="absolute top-[22px] right-[0px] z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/70 hover:bg-[#D6D9DF]">
                <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
              </div>
            </h2>

            <div v-if="isLoaded" class="flex flex-col grow relative w-full">
              <DialogDescription class="opacity-80 font-light py-6 pl-10 pr-[6%]">
                Commander uses an automated bidding bot to maximize your chance of winning seats, and this screen allows you to
                configure the rules for how this bot should make decisions on your behalf. Use your mouse to explore the various
                settings and their impact on your potential profits.
              </DialogDescription>

              <section class="flex flex-row border-t border-b border-slate-500/30 text-center pt-8 pb-8 px-3.5 mx-5 justify-stretch">
                <div class="w-1/2 flex flex-col grow">
                  <CapitalOverlay align="start" :width="capitalBoxWidth">
                    <div PrimaryStat @mouseenter="capitalBoxWidth = calculateElementWidth($event?.target as HTMLElement)" class="flex flex-col grow group border border-slate-500/30 rounded-lg shadow-sm">
                      <header StatHeader class="mx-0.5 pt-5 pb-0 relative">
                        Capital {{ isBrandNew ? 'to Commit' : 'Committed' }}
                      </header>
                      <div class="grow flex flex-col mt-3 border-t border-slate-500/30 border-dashed w-10/12 mx-auto">
                        <div class="text-gray-500/60 border-b border-slate-500/30 border-dashed py-3 w-full">
                          To secure your goal of {{getEpochSeatGoalCount()}} mining seats per epoch, you need
                        </div>
                        <div class="flex flex-row items-center justify-center grow relative h-26 font-bold font-mono text-argon-600">
                          <NeedMoreCapitalHover v-if="probableMinSeats < getEpochSeatGoalCount()" :calculator="calculator" :seat-goal-count="getEpochSeatGoalCount()" :ideal-capital-commitment="getMinimumCapitalCommitment()" @increase-capital-commitment="updateMinimumCapital()" />
                          <InputArgon v-model="capitalToCommitMicrogons" :min="10_000_000n" :minDecimals="0" />
                        </div>
                        <div class="text-gray-500/60 border-t border-slate-500/30 border-dashed py-5 w-full mx-auto">
                          This is the amount of capital you'll need to acquire<br/>
                          {{ micronotToArgonotNm(rules.baseMicronotCommitment).format('0,0') }} argonot{{ micronotToArgonotNm(rules.baseMicronotCommitment).format('0,0') === '1' ? '' : 's' }} 
                          and {{ microgonToArgonNm(rules.baseMicrogonCommitment).format('0,0') }} argon{{ microgonToArgonNm(rules.baseMicrogonCommitment).format('0,0') === '0,0' ? '' : 's' }} 
                          at current market rates.
                        </div>
                      </div>
                    </div>
                  </CapitalOverlay>
                </div>
                <div class="flex flex-col items-center justify-center text-3xl mx-2 text-center">
                  <span class="relative -top-1 opacity-50">
                    =
                  </span>
                </div>
                <div class="w-1/2 flex flex-col grow">
                  <ReturnsOverlay align="end" :width="returnsBoxWidth">
                    <div PrimaryStat @mouseenter="returnsBoxWidth = calculateElementWidth($event?.target as HTMLElement)" class="flex flex-col grow group border border-slate-500/30 rounded-lg shadow-sm">
                      <header StatHeader class="mx-0.5 pt-5 pb-0 relative">
                        Return on Capital
                      </header>
                      <div class="grow flex flex-col mt-3 border-t border-slate-500/30 border-dashed w-10/12 mx-auto">
                        <div class="text-gray-500/60 border-b border-slate-500/30 border-dashed py-3 w-full">
                          Your capital is estimated to return {{ numeral(epochPercentageYield).formatCapped('0,0.00', 999_999) }}% per epoch at an APY of
                        </div>
                        <div class="flex flex-row items-center justify-center grow relative h-26 text-6xl font-bold font-mono text-argon-600">
                          {{ numeral(averageAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 999_999) }}%
                        </div>
                        <div class="text-gray-500/60 border-t border-slate-500/30 border-dashed py-5 w-full">
                        This represents the average return between your starting<br />
                        bid and maximum bid, between slow growth and fast growth.
                      </div>
                      </div>
                    </div>
                  </ReturnsOverlay>
                </div>
              </section>

              <div class="flex flex-col relative grow px-5 text-lg">
                <section class="flex flex-row h-1/2 my-2">

                  <div MainWrapperParent class="flex flex-col items-center justify-center relative w-1/3">
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.startingBid, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay($event, 'startingBid')" class="flex flex-col w-full h-full items-center justify-center px-8">
                      <div StatHeader>Starting Bid</div>
                      <div v-if="startingBidAmountOverride" MainRule class="w-full flex flex-row items-center justify-center space-x-2">
                        <AlertIcon class="w-5 h-5 text-yellow-700 inline-block relative -top-0.5" />
                        <span class="line-through text-gray-500/60">{{ currency.symbol }}{{ microgonToMoneyNm(startingBidAmount).format('0,0.00') }}</span>
                        <span>{{ currency.symbol }}{{ microgonToMoneyNm(startingBidAmountOverride).format('0,0.00') }}</span>
                      </div>
                      <div v-else MainRule class="w-full">
                        {{ currency.symbol }}{{ microgonToMoneyNm(startingBidAmount).format('0,0.00') }}
                      </div>
                      <div class="text-gray-500/60 text-md">
                        <span v-if="rules.startingBidFormulaType === BidAmountFormulaType.Custom">Custom Value</span>
                        <template v-else>
                          <span>{{ rules.startingBidFormulaType }}</span>
                          <span v-if="rules.startingBidAdjustmentType === BidAmountAdjustmentType.Absolute && rules.startingBidAdjustAbsolute">
                            {{ rules.startingBidAdjustAbsolute > 0 ? '+' : '-'
                            }}{{ currency.symbol
                            }}{{
                              microgonToMoneyNm(
                                rules.startingBidAdjustAbsolute < 0n ? -rules.startingBidAdjustAbsolute : rules.startingBidAdjustAbsolute,
                              ).format('0.00')
                            }}
                          </span>
                          <span v-else-if="rules.startingBidAdjustRelative">
                            &nbsp;{{ rules.startingBidAdjustRelative > 0 ? '+' : '-'
                            }}{{ numeral(Math.abs(rules.startingBidAdjustRelative)).format('0.[00]') }}%
                          </span>
                        </template>
                      </div>
                    </div>
                  </div>

                  <div class="w-[1px] bg-slate-300/80 mx-2"></div>

                  <div MainWrapperParent class="flex flex-col items-center justify-center relative w-1/3">
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.maximumBid, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay($event, 'maximumBid')" class="flex flex-col w-full h-full items-center justify-center px-8">
                      <div StatHeader>Maximum Bid</div>
                      <div v-if="maximumBidAmountOverride" MainRule class="w-full flex flex-row items-center justify-center space-x-2">
                        <AlertIcon class="w-5 h-5 text-yellow-700 inline-block relative -top-0.5" />
                        <span class="line-through text-gray-500/60">{{ currency.symbol }}{{ microgonToMoneyNm(maximumBidAmount).format('0,0.00') }}</span>
                        <span>{{ currency.symbol }}{{ microgonToMoneyNm(maximumBidAmountOverride).format('0,0.00') }}</span>
                      </div>
                      <div v-else MainRule class="w-full">
                        {{ currency.symbol }}{{ microgonToMoneyNm(maximumBidAmount).format('0,0.00') }}
                      </div>
                      <div class="text-gray-500/60 text-md">
                        <span v-if="rules.maximumBidFormulaType === BidAmountFormulaType.Custom">Custom Value</span>
                        <template v-else>
                          <span>{{ rules.maximumBidFormulaType }}</span>
                          <span v-if="rules.maximumBidAdjustmentType === BidAmountAdjustmentType.Absolute && rules.maximumBidAdjustAbsolute">
                            {{ rules.maximumBidAdjustAbsolute > 0 ? '+' : '-'
                            }}{{ currency.symbol
                            }}{{ microgonToMoneyNm(bigIntAbs(rules.maximumBidAdjustAbsolute)).format('0.00') }}
                          </span>
                          <span v-else-if="rules.maximumBidAdjustRelative">
                            &nbsp;{{ rules.maximumBidAdjustRelative > 0 ? '+' : '-'
                            }}{{ numeral(Math.abs(rules.maximumBidAdjustRelative)).format('0.[00]') }}%
                          </span>
                        </template>
                      </div>
                    </div>
                  </div>

                  <div class="w-[1px] bg-slate-300/80 mx-2"></div>

                  <div MainWrapperParent class="flex flex-col items-center justify-center relative w-1/3">
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.rebiddingStrategy, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay($event, 'rebiddingStrategy')" class="flex flex-col w-full h-full items-center justify-center px-8">
                      <div StatHeader>Rebidding Strategy</div>
                      <div MainRule class="w-full">
                        +{{ currency.symbol }}{{ microgonToMoneyNm(rules.rebiddingIncrementBy).format('0.00') }}
                      </div>
                      <div class="text-gray-500/60 text-md">
                        Delay By {{ rules.rebiddingDelay }} Minute{{ rules.rebiddingDelay === 1 ? '' : 's' }}
                      </div>
                    </div>
                  </div>

                </section>

                <div class="flex flex-row h-[1px]">
                  <div class="w-1/3 bg-slate-300/80"></div>
                  <div class="w-[1px] mx-2"></div>
                  <div class="w-1/3 bg-slate-300/80"></div>
                  <div class="w-[1px] mx-2"></div>
                  <div class="w-1/3 bg-slate-300/80"></div>
                </div>

                <section class="flex flex-row h-1/2 my-2">
                  <div MainWrapperParent class="flex flex-col items-center justify-center relative w-1/3">
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.capitalAllocation, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay($event, 'capitalAllocation')" class="flex flex-col w-full h-full items-center justify-center px-8">
                      <div StatHeader>Capital Allocation</div>
                      <div MainRule v-if="rules.seatGoalType === SeatGoalType.Max && rules.seatGoalCount === 0" class="w-full">
                        Disabled
                      </div>
                      <div MainRule v-else class="w-full">
                       {{ rules.seatGoalType }} {{ rules.seatGoalCount }} Seats Per {{ rules.seatGoalInterval }}
                      </div>
                      <div class="text-gray-500/60 text-md">
                        {{ rules.seatGoalType === SeatGoalType.Max ? 'Stop After Goal Reached' : 'Reinvest Profits from Operation' }}
                      </div>
                    </div>
                  </div>

                  <div class="w-[1px] bg-slate-300/80 mx-2"></div>

                  <div MainWrapperParent class="flex flex-col items-center justify-center relative w-1/3">
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.expectedGrowth, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay($event, 'expectedGrowth')" class="flex flex-col w-full h-full items-center justify-center">
                      <div StatHeader>Ecosystem Growth</div>
                      <div class="flex flex-row items-center justify-center px-8 w-full text-center font-mono">
                        <div MainRule class="flex flex-row items-center justify-center w-5/12">
                          <span>{{ numeral(rules.argonCirculationGrowthPctMin).formatIfElse('0', '0', '+0.[0]') }}%</span>
                          <span class="text-md px-1.5 text-gray-500/60">to</span>
                          <span>{{ numeral(rules.argonCirculationGrowthPctMax).formatIfElse('0', '0', '+0.[0]')}}%</span>
                        </div>
                        <span class="text-md w-2/12 text-gray-500/60">&nbsp;and&nbsp;</span>
                        <div MainRule class="flex flex-row items-center justify-center w-5/12">
                          <span>{{ numeral(rules.argonotPriceChangePctMin).formatIfElse('0', '0', '+0.[0]') }}%</span>
                          <span class="text-md px-1.5 text-gray-500/60">to</span>
                          <span>{{ numeral(rules.argonotPriceChangePctMax).formatIfElse('0', '0', '+0.[0]')}}%</span>
                        </div>
                      </div>
                      <div class="flex flex-row items-center justify-center px-10 w-full text-center font-mono ">
                        <div class="flex flex-row items-center justify-center text-md px-1 text-gray-500/60 w-5/12">
                          Argons
                        </div>
                        <span class="text-md w-2/12 text-gray-500/60">&nbsp;</span>
                        <div class="flex flex-row items-center justify-center text-md text-gray-500/60 w-5/12">
                          Argonots
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="w-[1px] bg-slate-300/80 mx-2"></div>

                  <div MainWrapperParent class="flex flex-col items-center justify-center relative w-1/3">
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.cloudMachine, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay($event, 'cloudMachine')" class="flex flex-col w-full h-full items-center justify-center px-8">
                      <div StatHeader>Cloud Machine</div>
                      <div MainRule class="tracking-widest w-full">
                        {{ config.serverDetails.ipAddress || '0.0.0.0' }}
                      </div>
                      <div class="text-gray-500/60 text-md font-mono">
                        {{ config.isMinerInstalled ? 'Existing Server' : 'New Server' }}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
            <div v-else>Loading...</div>

            <div class="flex flex-row justify-end border-t border-slate-300 mx-4 py-4 space-x-4 rounded-b-lg">
              <div class="flex flex-row space-x-4 justify-center items-center">
                <ActiveBidsOverlayButton :loadFromMainchain="true" class="mr-10">
                  <span class="text-argon-600/70 cursor-pointer">Show Existing Mining Bids</span>
                </ActiveBidsOverlayButton>
                <button @click="cancelOverlay" class="border border-argon-button/50 hover:border-argon-button text-xl font-bold text-gray-500 px-7 py-1 rounded-md cursor-pointer">
                  <span>Cancel</span>
                </button>
                <button @click="saveRules" @mouseenter="showTooltip($event, tooltip.saveRules, { width: 'parent' })" @mouseleave="hideTooltip" class="bg-argon-button hover:border-argon-800 text-xl font-bold text-white px-7 py-1 rounded-md cursor-pointer">
                  <span v-if="!isSaving">{{ isBrandNew ? 'Initialize' : 'Update' }} Rules</span>
                  <span v-else>{{ isBrandNew ? 'Initializing' : 'Updating' }} Rules...</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import BigNumber from 'bignumber.js';
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import basicEmitter from '../emitters/basicEmitter';
import { useConfig } from '../stores/config';
import { useCurrency } from '../stores/currency';
import { getCalculator, getCalculatorData } from '../stores/mainchain';
import { getDbPromise } from '../stores/helpers/dbPromise';
import numeral, { createNumeralHelpers } from '../lib/numeral';
import BgOverlay from '../components/BgOverlay.vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import AlertIcon from '../assets/alert.svg?component';
import { hideTooltip, showTooltip as showTooltipOriginal } from '../lib/TooltipUtils';
import EditBoxOverlay, { type IEditBoxOverlayTypeForMining } from './EditBoxOverlay.vue';
import { type IBiddingRules, JsonExt } from '@argonprotocol/commander-core';
import ActiveBidsOverlayButton from './ActiveBidsOverlayButton.vue';
import {
  BidAmountAdjustmentType,
  BidAmountFormulaType,
  SeatGoalInterval,
  SeatGoalType,
} from '@argonprotocol/commander-core/src/IBiddingRules.ts';
import { bigIntAbs, bigNumberToInteger, ceilTo } from '@argonprotocol/commander-core/src/utils';
import InputArgon from '../components/InputArgon.vue';
import NeedMoreCapitalHover from './bot/NeedMoreCapitalHover.vue';
import ReturnsOverlay from './bot/BotReturns.vue';
import CapitalOverlay from './bot/BotCapital.vue';
import { useInstaller } from '../stores/installer.ts';
import { useBot } from '../stores/bot.ts';

const calculator = getCalculator();
const calculatorData = getCalculatorData();

let previousBiddingRules: string | null = null;

const currency = useCurrency();
const config = useConfig();
const dbPromise = getDbPromise();
const installer = useInstaller();
const bot = useBot();

const { microgonToMoneyNm, microgonToArgonNm, micronotToArgonotNm } = createNumeralHelpers(currency);

const rules = Vue.computed(() => {
  return config.biddingRules as IBiddingRules;
});

const isBrandNew = Vue.ref(true);
const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);
const isSaving = Vue.ref(false);

const capitalBoxWidth = Vue.ref('');
const returnsBoxWidth = Vue.ref('');

const editBoxOverlayId = Vue.ref<IEditBoxOverlayTypeForMining | null>(null);
const editBoxOverlayPosition = Vue.ref<{ top?: number; left?: number; width?: number } | undefined>(undefined);
const dialogPanel = Vue.ref(null);

const probableMinSeats = Vue.ref(0);
const probableMaxSeats = Vue.ref(0);

const startingBidAmount = Vue.ref(0n);
const startingBidAmountOverride = Vue.ref<bigint | null>(null);
const maximumBidAmount = Vue.ref(0n);
const maximumBidAmountOverride = Vue.ref<bigint | null>(null);

const startingBidAtSlowGrowthAPY = Vue.ref(0);
const startingBidAtFastGrowthAPY = Vue.ref(0);
const maximumBidAtSlowGrowthAPY = Vue.ref(0);
const maximumBidAtFastGrowthAPY = Vue.ref(0);
const capitalToCommitMicrogons = Vue.ref(0n);

const averageAPY = Vue.ref(0);
const averageEarnings = Vue.ref(0n);
const epochPercentageYield = Vue.ref(0);

const tooltip = {
  capitalToCommit:
    'The more capital you put in, the more seats you have a chance to win and therefore the higher your earning potential.',
  estimatedAPYRange:
    'These estimates are based on the guaranteed block rewards locked on-chain combined with the bidding variables shown on this page.',
  startingBid: `This is your starting bid price. Don't put it too low or you'll be forced to pay unneeded transaction fees in order to submit a rebid.`,
  rebiddingStrategy: Vue.computed(
    () =>
      `If your bids get knocked out of contention, your bot will wait ${rules.value.rebiddingDelay} minute${rules.value.rebiddingDelay === 1 ? '' : 's'} before submitting a new bid at ${currency.symbol}${microgonToMoneyNm(rules.value.rebiddingIncrementBy).format('0.00')} above the current winning bid.`,
  ),
  maximumBid: `Your mining bot will never submit a bid above this price. If other bidders go higher than this, you will be knocked out of contention.`,
  capitalAllocation: Vue.computed(() => {
    let interval =
      rules.value.seatGoalInterval === SeatGoalInterval.Epoch
        ? `An "epoch" is equivalent to 10 days`
        : `A "frame" is equivalent to 1 day`;
    return `This is your bot's goal, not its ceiling. ${interval}. If the bot can snag more than ${seatGoalText()}, it will do so. If it fails to achieve its goal, it will alert you in the app.`;
  }),
  expectedGrowth: `These numbers don't affect your bot's decisions; they only factor into the Estimated APY shown above. Argons is growth in circulation; Argonots is change in token price. Both are factored annually.`,
  cloudMachine: `You can leave this server configuration box as-is for now. Later in the process, we'll guide you through the step-by-step flow of how to set up a new Cloud Machine. Don't worry, it's easy.`,
  saveRules: `Let's go! You can modify the rules later.`,
};

function calculateElementWidth(element: HTMLElement) {
  return element.getBoundingClientRect().width + 'px';
}

function getEpochSeatGoalCount() {
  if (rules.value.seatGoalType === SeatGoalType.MaxPercent || rules.value.seatGoalType === SeatGoalType.MinPercent) {
    return Math.floor((rules.value.seatGoalPercent / 100) * calculatorData.maxPossibleMiningSeatCount);
  }
  let seats = rules.value.seatGoalCount;
  if (rules.value.seatGoalInterval === SeatGoalInterval.Frame) {
    seats *= 10; // 10 frames per epoch
  }
  return seats;
}

function seatGoalText() {
  if (rules.value.seatGoalType === SeatGoalType.MaxPercent || rules.value.seatGoalType === SeatGoalType.MinPercent) {
    return `${rules.value.seatGoalPercent}% of all seats`;
  } else {
    return `${rules.value.seatGoalCount} seats`;
  }
}

function openEditBoxOverlay($event: MouseEvent, type: IEditBoxOverlayTypeForMining) {
  const parent = ($event.target as HTMLElement).closest('[MainWrapperParent]');
  const rect = parent?.getBoundingClientRect() as DOMRect;
  editBoxOverlayPosition.value = {
    top: rect.top,
    left: rect.left,
    width: rect.width,
  };
  editBoxOverlayId.value = type;
}

function cancelOverlay() {
  if (editBoxOverlayId.value) return;
  isOpen.value = false;
  hideTooltip();

  if (previousBiddingRules) {
    config.biddingRules = JsonExt.parse<IBiddingRules>(previousBiddingRules);
  }
}

async function saveRules() {
  isSaving.value = true;

  let didSave = false;
  if (rules.value) {
    await config.saveBiddingRules();
    didSave = true;
  }

  isSaving.value = false;
  isOpen.value = false;
  if (config.isMinerInstalled && didSave) {
    try {
      await bot.resyncBiddingRules();
    } catch (error) {
      console.error('Failed to reload server bidding rules:', error);
    }
  }
  hideTooltip();
}

function showTooltip(
  event: MouseEvent,
  label: string | Vue.ComputedRef<string>,
  flags: { width?: 'parent'; widthPlus?: number } = {},
) {
  if (editBoxOverlayId.value) return;
  showTooltipOriginal(event, label, flags);
}

function updateAPYs() {
  calculator.updateBiddingRules(rules.value);
  calculator.calculateBidAmounts();

  startingBidAmount.value = calculator.startingBidAmount;
  startingBidAmountOverride.value = calculator.startingBidAmountOverride;

  maximumBidAmount.value = calculator.maximumBidAmount;
  maximumBidAmountOverride.value = calculator.maximumBidAmountOverride;

  startingBidAtSlowGrowthAPY.value = calculator.startingBidAtSlowGrowthAPY;
  startingBidAtFastGrowthAPY.value = calculator.startingBidAtFastGrowthAPY;
  maximumBidAtSlowGrowthAPY.value = calculator.maximumBidAtSlowGrowthAPY;
  maximumBidAtFastGrowthAPY.value = calculator.maximumBidAtFastGrowthAPY;

  averageAPY.value = calculator.averageAPY;

  const epochMinimumSlowYield = calculator.calculateTenDayYield('minimum', 'slow');
  const epochMinimumFastYield = calculator.calculateTenDayYield('minimum', 'fast');
  const epochMaximumSlowYield = calculator.calculateTenDayYield('maximum', 'slow');
  const epochMaximumFastYield = calculator.calculateTenDayYield('maximum', 'fast');
  epochPercentageYield.value =
    (epochMinimumSlowYield + epochMinimumFastYield + epochMaximumSlowYield + epochMaximumFastYield) / 4;

  const maxAffordableSeats = rules.value.baseMicronotCommitment / calculatorData.micronotsRequiredForBid;

  const probableMinSeatsBn = BigNumber(rules.value.baseMicrogonCommitment).dividedBy(calculator.maximumBidAmount);
  probableMinSeats.value = Math.max(bigNumberToInteger(probableMinSeatsBn), 0);
  if (probableMinSeats.value > maxAffordableSeats) {
    probableMinSeats.value = Number(maxAffordableSeats);
  }

  const probableMaxSeatsBn = BigNumber(rules.value.baseMicrogonCommitment).dividedBy(calculator.startingBidAmount);
  probableMaxSeats.value = Math.min(bigNumberToInteger(probableMaxSeatsBn), calculatorData.maxPossibleMiningSeatCount);
  if (probableMaxSeats.value > maxAffordableSeats) {
    probableMaxSeats.value = Number(maxAffordableSeats);
  }

  const slowGrowthEarnings = BigInt(probableMinSeats.value) * calculator.slowGrowthRewards;
  const fastGrowthEarnings = BigInt(probableMaxSeats.value) * calculator.fastGrowthRewards;
  averageEarnings.value = (slowGrowthEarnings + fastGrowthEarnings) / 2n;
}

Vue.watch(capitalToCommitMicrogons, capital => {
  const seatCount = BigInt(getEpochSeatGoalCount());
  rules.value.baseMicronotCommitment = seatCount * calculatorData.micronotsRequiredForBid;
  rules.value.baseMicrogonCommitment = capital - rules.value.baseMicronotCommitment;
});

function getMinimumCapitalCommitment(): bigint {
  const epochSeatGoal = BigInt(getEpochSeatGoalCount());
  const minimumCapitalNeeded = calculator.maximumBidAmount * epochSeatGoal;
  const minimumCapitalNeededRoundedUp = ceilTo(minimumCapitalNeeded, 6);
  const micronotsNeeded = epochSeatGoal * calculatorData.micronotsRequiredForBid;
  return currency.micronotToMicrogon(micronotsNeeded) + BigInt(minimumCapitalNeededRoundedUp);
}

function updateMinimumCapital() {
  capitalToCommitMicrogons.value = getMinimumCapitalCommitment();
}

Vue.watch(
  rules,
  () => {
    if (isOpen.value) {
      updateAPYs();
    }
  },
  { deep: true },
);

basicEmitter.on('openBotOverlay', async () => {
  if (isOpen.value) return;
  isLoaded.value = false;
  isOpen.value = true;

  isBrandNew.value = !config.hasSavedBiddingRules;
  calculatorData.isInitializedPromise.then(() => {
    previousBiddingRules = JsonExt.stringify(config.biddingRules);
    capitalToCommitMicrogons.value = getMinimumCapitalCommitment();
    updateAPYs();
    if (isBrandNew.value && startingBidAtFastGrowthAPY.value > 20_000) {
      /*
        The default startingBidFormulaType is set at PreviousDayLow, which at least on testnet, is creating a
        situation where the projected returns are astronomically high (and seemingly unrealistic). In order to
        create a more realistic projected return, we're setting the startingBidFormulaType to 12% below BreakevenAtSlowGrowth.
        We might remove this IF block in the future, but it seems a good safety fix for now.
      */
      config.biddingRules.startingBidFormulaType = BidAmountFormulaType.BreakevenAtSlowGrowth;
      config.biddingRules.startingBidAdjustmentType = BidAmountAdjustmentType.Relative;
      config.biddingRules.startingBidAdjustRelative = -12.0;
    }
    isLoaded.value = true;
  });
});
</script>

<style>
@reference "../main.css";

.BotOverlay {
  h2 {
    position: relative;
    &:before {
      @apply from-argon-menu-bg bg-gradient-to-r to-transparent;
      content: '';
      display: block;
      width: 30px;
      position: absolute;
      z-index: 1;
      left: -5px;
      top: 0;
      bottom: -5px;
    }
    &:after {
      @apply from-argon-menu-bg bg-gradient-to-l to-transparent;
      content: '';
      display: block;
      width: 30px;
      position: absolute;
      z-index: 1;
      right: -5px;
      top: 0;
      bottom: -5px;
    }
  }

  [StatHeader] {
    @apply group-hover:text-argon-600/70 text-lg font-bold text-[#a08fb7];
  }

  [PrimaryStat] {
    @apply relative;

    div[InputFieldWrapper] {
      @apply text-argon-600 border-none font-mono text-6xl font-bold !outline-none hover:bg-transparent focus:!outline-none;
      box-shadow: none;
    }
    div[NumArrows] {
      @apply relative top-2;
    }
    svg[NumArrowUp],
    svg[NumArrowDown] {
      @apply size-[24px];
    }

    [StatHeader] {
      @apply text-argon-600/70;
      background: linear-gradient(to bottom, oklch(0.88 0.09 320 / 0.2) 0%, transparent 100%);
      text-shadow: 1px 1px 0 white;
    }
  }

  section div[StatHeader] {
    @apply pt-1;
  }

  section div[MainWrapper] {
    @apply cursor-pointer;

    &:hover {
      @apply bg-argon-20;
      [MainRule]::before {
        background: linear-gradient(to right, var(--color-argon-20) 0%, transparent 100%);
      }
      [MainRule]::after {
        background: linear-gradient(to left, var(--color-argon-20) 0%, transparent 100%);
      }
      [StatHeader] {
        @apply text-argon-600/70;
      }
    }

    [MainRule] {
      @apply text-argon-700/80 relative mt-1 mb-1 border-t border-b border-dashed border-slate-500/30 py-1 text-center font-mono font-bold;
      &::before {
        content: '';
        display: block;
        width: 10%;
        height: calc(100% + 4px);
        background: linear-gradient(to right, var(--color-argon-menu-bg) 0%, transparent 100%);
        position: absolute;
        top: -2px;
        left: 0;
      }
      &::after {
        content: '';
        display: block;
        width: 10%;
        height: calc(100% + 4px);
        background: linear-gradient(to left, var(--color-argon-menu-bg) 0%, transparent 100%);
        position: absolute;
        top: -2px;
        right: 0;
      }
      span {
        @apply relative z-10;
      }
    }
  }
}
</style>
