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
              <DialogTitle as="div" class="relative z-10">{{ isBrandNew ? 'Create' : 'Update' }} Personal Mining Bot</DialogTitle>
              <div @click="cancelOverlay" class="absolute top-[22px] right-[0px] z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/70 hover:bg-[#D6D9DF]">
                <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
              </div>
            </h2>

            <div v-if="isLoaded" class="flex flex-col grow relative w-full">
              <DialogDescription class="opacity-80 font-light py-6 pl-10 pr-[6%]">
                Commander uses an automated bidding bot to maximize your chance of winning seats. This screen allows you to 
                configure the rules for how your bot should make decisions and place bids. You can also  <span class="text-argon-600/80 hover:text-argon-600 cursor-pointer font-bold">import from an existing cloud machine</span>.
              </DialogDescription>

              <section class="flex flex-row border-t border-b border-slate-300 text-center pt-8 pb-8 px-5 mx-5 justify-stretch">
                <div class="w-1/2 flex flex-col grow">
                  <!-- @mouseenter="showTooltip($event, tooltip.capitalToCommit, { width: 'parent' })" @mouseleave="hideTooltip"  -->
                  <div class="flex flex-col grow group">
                    <header StatHeader class="bg-[#FAF9FA] border border-[#DDDCDD] rounded-t-lg group-hover:text-argon-600/70 relative z-10">
                      Capital {{ isBrandNew ? 'to Commit' : 'Committed' }}
                    </header>
                    <div PrimaryStat class="grow relative border border-slate-500/30 rounded-lg mt-2 pb-12 pt-10 text-5xl font-bold font-mono text-argon-600 shadow-sm">
                      <NeedMoreCapitalHover v-if="probableMinSeats < rules.seatGoalCount" :calculator="calculator" />
                      <InputArgon v-model="rules.baseCapitalCommitment" :min="10_000_000n" :minDecimals="0" />
                    </div>
                  </div>
                  <div class="pt-3 text-argon-600/70 text-md">
                    <span class="cursor-pointer">
                      View Seat Probabilities 
                      <template v-if="probableMinSeats === probableMaxSeats">({{ probableMinSeats }} seats)</template>
                      <template v-else>(between {{ probableMinSeats }} and {{ probableMaxSeats }} seats)</template>
                    </span>
                  </div>
                </div>
                <div class="flex flex-col items-center justify-center text-3xl mx-2 text-center">
                  <span class="relative -top-1 opacity-50">
                    =
                  </span>
                </div>
                <div class="w-1/2 flex flex-col grow">
                  <div @mouseenter="showTooltip($event, tooltip.estimatedAPYRange, { width: 'parent' })" @mouseleave="hideTooltip" class="flex flex-col grow group">
                    <header StatHeader class="bg-[#FAF9FA] border border-[#DDDCDD] rounded-t-lg relative z-10">Annual Percentage Yields (APY)</header>
                    <div PrimaryStat class="grow flex flex-col border border-slate-500/30 rounded-lg mt-2 shadow-sm w-full px-4">
                      <table class="w-full h-full table-fixed relative z-50 whitespace-nowrap -mt-1">
                        <tbody>
                          <tr class="text-argon-600 h-1/3">
                            <td class="w-5/12"></td>
                            <td class="font-light font-sans text-argon-800/40 w-5/12">Slow Growth</td>
                            <td class="font-light font-sans text-argon-800/40 w-5/12">Fast Growth</td>
                          </tr>
                          <tr class="font-bold font-mono text-argon-600 h-1/3">
                            <td class="font-light font-sans text-argon-800/40 border-t border-dashed border-slate-300 text-left pl-2 pr-10">Maximum Bid ({{ currency.symbol }}{{ microgonToMoneyNm(maximumBidAmount).format('0,0.00') }})</td>
                            <td class="text-lg border-t border-dashed border-slate-300">{{ numeral(maximumBidAtSlowGrowthAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 999_999) }}%</td>
                            <td class="text-lg border-t border-dashed border-slate-300">{{ numeral(maximumBidAtFastGrowthAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 999_999) }}%</td>
                          </tr>
                          <tr class="font-bold font-mono text-argon-600 h-1/3">
                            <td class="font-light font-sans text-argon-800/40 border-t border-dashed border-slate-300 text-left pl-2 pr-10">Starting Bid ({{ currency.symbol }}{{ microgonToMoneyNm(minimumBidAmount).format('0,0.00') }})</td>
                            <td class="text-lg border-t border-dashed border-slate-300">{{ numeral(minimumBidAtSlowGrowthAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 999_999) }}%</td>
                            <td class="text-lg border-t border-dashed border-slate-300">{{ numeral(minimumBidAtFastGrowthAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 999_999) }}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div class="pt-3 text-argon-600/70 text-md">
                    <span class="cursor-pointer">View Risk Analysis (it's 99% from server ops)</span>
                  </div>
                </div>
              </section>

              <div class="flex flex-col relative grow px-5 text-lg">
                <section class="flex flex-row h-1/2 my-2">

                  <div MainWrapperParent class="flex flex-col items-center justify-center relative w-1/3">
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.minimumBid, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay($event, 'minimumBid')" class="flex flex-col w-full h-full items-center justify-center px-8">
                      <div StatHeader>Starting Bid</div>
                      <div v-if="minimumBidAmountOverride" MainRule class="w-full flex flex-row items-center justify-center space-x-2">
                        <AlertIcon class="w-5 h-5 text-yellow-700 inline-block relative -top-0.5" />
                        <span class="line-through text-gray-500/60">{{ currency.symbol }}{{ microgonToMoneyNm(minimumBidAmount).format('0,0.00') }}</span>
                        <span>{{ currency.symbol }}{{ microgonToMoneyNm(minimumBidAmountOverride).format('0,0.00') }}</span>
                      </div>
                      <div v-else MainRule class="w-full">
                        {{ currency.symbol }}{{ microgonToMoneyNm(minimumBidAmount).format('0,0.00') }}
                      </div>
                      <div class="text-gray-500/60 text-md">
                        <span v-if="rules.minimumBidFormulaType === BidAmountFormulaType.Custom">Custom Value</span>
                        <template v-else>
                          <span>{{ rules.minimumBidFormulaType }}</span>
                          <span v-if="rules.minimumBidAdjustmentType === BidAmountAdjustmentType.Absolute && rules.minimumBidAdjustAbsolute">
                            {{ rules.minimumBidAdjustAbsolute > 0 ? '+' : '-' 
                            }}{{ currency.symbol
                            }}{{
                              microgonToMoneyNm(
                                rules.minimumBidAdjustAbsolute < 0n ? -rules.minimumBidAdjustAbsolute : rules.minimumBidAdjustAbsolute,
                              ).format('0.00')
                            }}
                          </span>
                          <span v-else-if="rules.minimumBidAdjustRelative">
                            &nbsp;{{ rules.minimumBidAdjustRelative > 0 ? '+' : '-' 
                            }}{{ numeral(Math.abs(rules.minimumBidAdjustRelative)).format('0.[00]') }}%
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
                        {{ config.isServerInstalled ? 'Existing Server' : 'New Server' }}
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
                <button @click="cancelOverlay" class="border border-argon-button text-xl font-bold text-gray-500 px-7 py-1 rounded-md cursor-pointer">
                  <span>Cancel</span>
                </button>
                <button @click="saveRules" @mouseenter="showTooltip($event, tooltip.saveRules, { width: 'parent' })" @mouseleave="hideTooltip" class="bg-argon-button text-xl font-bold text-white px-7 py-1 rounded-md cursor-pointer">
                  <span v-if="!isSaving">{{ isBrandNew ? 'Create Mining Bot' : 'Update Settings' }}</span>
                  <span v-else>{{ isBrandNew ? 'Creating Mining Bot...' : 'Updating Settings...' }}</span>
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
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, DialogDescription } from 'reka-ui';
import basicEmitter from '../emitters/basicEmitter';
import { useConfig } from '../stores/config';
import { useCurrency } from '../stores/currency';
import numeral, { createNumeralHelpers } from '../lib/numeral';
import BgOverlay from '../components/BgOverlay.vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import AlertIcon from '../assets/alert.svg?component';
import { showTooltip as showTooltipOriginal, hideTooltip } from '../lib/TooltipUtils';
import EditBoxOverlay, { type IEditBoxOverlayTypeForMining } from './EditBoxOverlay.vue';
import { type IBiddingRules } from '@argonprotocol/commander-calculator';
import { getCalculator, getCalculatorData } from '../stores/mainchain';
import ActiveBidsOverlayButton from './ActiveBidsOverlayButton.vue';
import {
  BidAmountAdjustmentType,
  BidAmountFormulaType,
  SeatGoalInterval,
  SeatGoalType,
} from '@argonprotocol/commander-calculator/src/IBiddingRules.ts';
import { bigIntAbs } from '@argonprotocol/commander-calculator/src/utils';
import { jsonParseWithBigInts, jsonStringifyWithBigInts } from '@argonprotocol/commander-calculator';
import InputArgon from '../components/InputArgon.vue';
import NeedMoreCapitalHover from './bot/NeedMoreCapitalHover.vue';

const calculator = getCalculator();
const calculatorData = getCalculatorData();

let previousBiddingRules: string | null = null;

const currency = useCurrency();
const config = useConfig();
const { microgonToMoneyNm } = createNumeralHelpers(currency);

const rules = Vue.computed(() => {
  return config.biddingRules as IBiddingRules;
});

const isBrandNew = Vue.ref(true);
const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);
const isSaving = Vue.ref(false);

const editBoxOverlayId = Vue.ref<IEditBoxOverlayTypeForMining | null>(null);
const editBoxOverlayPosition = Vue.ref<{ top?: number; left?: number; width?: number } | undefined>(undefined);
const dialogPanel = Vue.ref(null);

const probableMinSeats = Vue.ref(0);
const probableMaxSeats = Vue.ref(0);

const minimumBidAmount = Vue.ref(0n);
const minimumBidAmountOverride = Vue.ref<bigint | null>(null);
const maximumBidAmount = Vue.ref(0n);
const maximumBidAmountOverride = Vue.ref<bigint | null>(null);

const minimumBidAtSlowGrowthAPY = Vue.ref(0);
const minimumBidAtFastGrowthAPY = Vue.ref(0);
const maximumBidAtSlowGrowthAPY = Vue.ref(0);
const maximumBidAtFastGrowthAPY = Vue.ref(0);

const tooltip = {
  capitalToCommit:
    'The more capital you put in, the more seats you have a chance to win and therefore the higher your earning potential.',
  estimatedAPYRange:
    'These estimates are based on the guaranteed block rewards locked on-chain combined with the bidding variables shown on this page.',
  minimumBid: `This is your starting bid price. Don't put it too low or you'll be forced to pay unneeded transaction fees in order to submit a rebid.`,
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
    return `This is your bot's goal, not its ceiling. ${interval}. If the bot can snag more than ${rules.value.seatGoalCount} seats, it will do so. If it fails to achieve its goal, it will alert you.`;
  }),
  expectedGrowth: `These numbers don't affect your bot's decisions; they only factor into the Estimated APY shown above. Argons is growth in circulation; Argonots is change in token price. Both are factored annually.`,
  cloudMachine: `Leave this as-is. We'll guide you through setting up a new Cloud Machine on the next screen.`,
  saveRules: `Let's go! You can modify these settings later.`,
};

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
    config.biddingRules = jsonParseWithBigInts(previousBiddingRules) as IBiddingRules;
  }
}

function calculateMicronotsRequired(): bigint {
  let possibleSeats = Math.ceil(
    BigNumber(rules.value.baseCapitalCommitment).dividedBy(calculatorData.previousDayMidBid).toNumber(),
  );

  if (rules.value?.seatGoalType === SeatGoalType.Max) {
    possibleSeats = Math.min(possibleSeats, rules.value.seatGoalCount);
  }
  possibleSeats = Math.min(possibleSeats, calculatorData.miningSeatCount);

  const totalMicronotsRequired = BigInt(possibleSeats) * calculatorData.micronotsRequiredForBid;

  // Ceil to the nearest million (argonot)
  return BigInt(Math.ceil(Number(totalMicronotsRequired) / 1_000_000) * 1_000_000);
}

async function saveRules() {
  isSaving.value = true;

  if (rules.value) {
    rules.value.requiredMicronots = calculateMicronotsRequired();
    await config.saveBiddingRules();
  }

  isSaving.value = false;
  isOpen.value = false;
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

  if (isBrandNew.value) {
    const minimumCapitalNeeded = calculator.maximumBidAmount * BigInt(rules.value.seatGoalCount);
    const minimumCapitalNeededRoundedUp = Math.ceil(Number(minimumCapitalNeeded) / 1_000_000) * 1_000_000;
    config.biddingRules.baseCapitalCommitment = BigInt(minimumCapitalNeededRoundedUp);
  }

  minimumBidAmount.value = calculator.minimumBidAmount;
  minimumBidAmountOverride.value = calculator.minimumBidAmountOverride;

  maximumBidAmount.value = calculator.maximumBidAmount;
  maximumBidAmountOverride.value = calculator.maximumBidAmountOverride;

  minimumBidAtSlowGrowthAPY.value = calculator.minimumBidAtSlowGrowthAPY;
  minimumBidAtFastGrowthAPY.value = calculator.minimumBidAtFastGrowthAPY;
  maximumBidAtSlowGrowthAPY.value = calculator.maximumBidAtSlowGrowthAPY;
  maximumBidAtFastGrowthAPY.value = calculator.maximumBidAtFastGrowthAPY;

  const probableMinSeatsBn = BigNumber(rules.value.baseCapitalCommitment).dividedBy(calculator.maximumBidAmount);
  probableMinSeats.value = Math.max(probableMinSeatsBn.integerValue(BigNumber.ROUND_FLOOR).toNumber(), 0);

  const probableMaxSeatsBn = BigNumber(rules.value.baseCapitalCommitment).dividedBy(calculator.minimumBidAmount);
  probableMaxSeats.value = Math.min(
    probableMaxSeatsBn.integerValue(BigNumber.ROUND_FLOOR).toNumber(),
    calculatorData.miningSeatCount,
  );
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
    previousBiddingRules = jsonStringifyWithBigInts(config.biddingRules);
    updateAPYs();
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
      @apply bg-gradient-to-r from-argon-menu-bg to-transparent;
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
      @apply bg-gradient-to-l from-argon-menu-bg to-transparent;
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
    @apply text-[#a08fb7] font-bold text-lg group-hover:text-argon-600/70;
  }

  [PrimaryStat] {
    @apply relative;
    &::before {
      @apply bg-gradient-to-b from-[5px] from-argon-menu-bg to-transparent;
      content: '';
      display: block;
      width: calc(100% + 10px);
      height: 30%;
      position: absolute;
      top: -5px;
      left: -5px;
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
      @apply text-argon-700/80 font-mono font-bold border-t border-b border-slate-500/30 border-dashed py-1 mt-1 mb-1 text-center relative;
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

  [PrimaryStat] {
    div {
      @apply inline-block;
    }
    div[InputFieldWrapper] {
      @apply outline-none border-none text-6xl font-bold font-mono text-argon-600 hover:bg-transparent;
      box-shadow: none;
    }
    div[NumArrows] {
      @apply relative top-1;
    }
    svg[NumArrowUp],
    svg[NumArrowDown] {
      @apply size-[24px];
    }
    /* span[Suffix] {
      @apply min-w-1;
    } */
  }
}
</style>
