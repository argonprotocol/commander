<!-- prettier-ignore -->
<template>
  <TransitionRoot class="absolute inset-0 z-10" :show="isOpen">
    <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
      <BgOverlay @close="cancelOverlay" />
    </TransitionChild>
    <Dialog @close="cancelOverlay" :initialFocus="dialogPanel">
      <DialogPanel class="absolute top-0 left-0 right-0 bottom-0 z-10">
        <div
          ref="dialogPanel"
          class="absolute top-[40px] left-3 right-3 bottom-3 flex flex-col rounded-md border border-black/30 inner-input-shadow bg-argon-menu-bg text-left transition-all"
          style="box-shadow: 0px -1px 2px 0 rgba(0, 0, 0, 0.1), inset 0 2px 0 rgba(255, 255, 255, 1);">
          <div v-if="showEditBoxOverlay" @click="showEditBoxOverlay = null" class="absolute top-0 left-0 w-full h-full z-40 bg-black/10"></div>
          <div v-if="isLoaded" class="flex flex-col h-full w-full">
            <h2
              class="relative text-3xl font-bold text-left border-b border-slate-300 pt-5 pb-4 pl-3 mx-4 text-[#672D73]"
              style="box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1)"
            >
              {{ isBrandNew ? 'Create' : 'Update' }} Personal Mining Bot
              <div @click="cancelOverlay" class="absolute top-[22px] right-[0px] z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/70 hover:bg-[#D6D9DF]">
                <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
              </div>
            </h2>

            <div class="flex flex-col grow relative w-full">
              <p class="opacity-80 font-light py-6 pl-10 pr-[6%]">
                Commander uses an automated bidding bot to maximize your chance of winning seats. This screen allows you to 
                configure the rules for how your bot should make decisions and place bids.
              </p>

              <section class="flex flex-row border-t border-b border-slate-300 text-center space-x-10 pt-12 pb-12 px-5 mx-5">
                <div class="w-1/2">
                  <div @mouseenter="showTooltip($event, tooltip.capitalToCommit, { width: 'parent' })" @mouseleave="hideTooltip" class="flex flex-col group cursor-pointer">
                    <header StatHeader class="group-hover:text-argon-600/70 relative z-10">Capital to Commit</header>
                    <div PrimaryStat class="border border-slate-500/30 rounded-lg -mt-7 pb-10 pt-12 group-hover:bg-argon-20 text-4xl font-bold font-mono text-argon-600 shadow-sm">
                      {{ currency.symbol }}{{ microgonToMoneyNm(rules.requiredMicrogons).format('0,0.[00]') }}
                    </div>
                  </div>
                  <div class="pt-3 text-argon-600/70 cursor-pointer text-md">
                    View Seat Probabilities ({{ currency.symbol
                    }}{{ microgonToMoneyNm(startingBidAmount).format('0,0.00') }}
                    to
                    {{ currency.symbol }}{{ microgonToMoneyNm(finalBidAmount).format('0,0.00') }}
                    per seat)
                  </div>
                </div>
                <div class="w-1/2">
                  <div @mouseenter="showTooltip($event, tooltip.estimatedAPYRange, { width: 'parent' })" @mouseleave="hideTooltip" class="flex flex-col group cursor-pointer">
                    <header StatHeader class="group-hover:text-argon-600/70 relative z-10">Estimated APY Range</header>
                    <div PrimaryStat class="border border-slate-500/30 rounded-lg -mt-7 pb-10 pt-12 group-hover:bg-argon-20 text-4xl font-bold font-mono text-argon-600 shadow-sm">
                      {{ numeral(minimumAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 9_999) }}%
                      <span class="text-slate-500/80 font-normal text-xl relative -top-1 -mx-2">to</span>
                      {{ numeral(optimisticAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 9_999) }}%
                    </div>
                  </div>
                  <div class="pt-3 text-argon-600/70 cursor-pointer text-md">View Risk Analysis (99% from server ops)</div>
                </div>
              </section>

              <div class="flex flex-col relative grow px-5 text-lg">
                <section class="flex flex-row h-1/2 my-2">

                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="maximumBid"
                      v-if="showEditBoxOverlay === 'maximumBid'"
                      @close="showEditBoxOverlay = null"
                      class="-top-5 left-0"
                    />
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.maximumBid, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay('maximumBid')" class="flex flex-col w-full h-full items-center justify-center px-8">
                      <div StatHeader>Maximum Bid</div>
                      <div MainRule class="w-full">
                        {{ currency.symbol }}{{ microgonToMoneyNm(finalBidAmount).format('0,0.00') }}
                      </div>
                      <div class="text-gray-500/60 text-md">
                        <span v-if="rules.finalBidAmountFormulaType === BidAmountFormulaType.Custom">Custom Value</span>
                        <template v-else>
                          <span>{{ rules.finalBidAmountFormulaType }}</span>                        
                          <span v-if="rules.finalBidAmountAdjustmentType === BidAmountAdjustmentType.Absolute && rules.finalBidAmountAbsolute">
                            {{ rules.finalBidAmountAbsolute > 0 ? '+' : '-' 
                            }}{{ currency.symbol
                            }}{{ microgonToMoneyNm(bigIntAbs(rules.finalBidAmountAbsolute)).format('0.00') }}
                          </span>
                          <span v-else-if="rules.finalBidAmountRelative">
                            &nbsp;{{ rules.finalBidAmountRelative > 0 ? '+' : '-' 
                            }}{{ numeral(Math.abs(rules.finalBidAmountRelative)).format('0.[00]') }}%
                          </span>
                        </template>
                      </div>
                    </div>
                  </div>

                  <div class="w-[1px] bg-slate-300/80 mx-2"></div>

                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="startingBidAmount"
                      v-if="showEditBoxOverlay === 'startingBidAmount'"
                      @close="showEditBoxOverlay = null"
                      class="-top-5 left-1/2 -translate-x-1/2"
                    />
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.startingBidAmount, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay('startingBidAmount')" class="flex flex-col w-full h-full items-center justify-center px-8">
                      <div StatHeader>Starting Bid</div>
                      <div MainRule class="w-full">
                        {{ currency.symbol }}{{ microgonToMoneyNm(startingBidAmount).format('0,0.00') }}
                      </div>
                      <div class="text-gray-500/60 text-md">
                        <span v-if="rules.startingBidAmountFormulaType === BidAmountFormulaType.Custom">Custom Value</span>
                        <template v-else>
                          <span>{{ rules.startingBidAmountFormulaType }}</span>
                          <span v-if="rules.startingBidAmountAdjustmentType === BidAmountAdjustmentType.Absolute && rules.startingBidAmountAbsolute">
                            {{ rules.startingBidAmountAbsolute > 0 ? '+' : '-' 
                            }}{{ currency.symbol
                            }}{{
                              microgonToMoneyNm(
                                rules.startingBidAmountAbsolute < 0n ? -rules.startingBidAmountAbsolute : rules.startingBidAmountAbsolute,
                              ).format('0.00')
                            }}
                          </span>
                          <span v-else-if="rules.startingBidAmountRelative">
                            {{ rules.startingBidAmountAbsolute > 0 ? '+' : '-' 
                            }}{{ numeral(Math.abs(rules.startingBidAmountRelative)).format('0.[00]') }}%
                          </span>
                        </template>
                      </div>
                    </div>
                  </div>
                  
                  <div class="w-[1px] bg-slate-300/80 mx-2"></div>

                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="rebiddingStrategy"
                      v-if="showEditBoxOverlay === 'rebiddingStrategy'"
                      @close="showEditBoxOverlay = null"
                      class="-top-5 right-0"
                    />
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.rebiddingStrategy, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay('rebiddingStrategy')" class="flex flex-col w-full h-full items-center justify-center px-8">
                      <div StatHeader>Rebidding Strategy</div>
                      <div MainRule class="w-full">
                        +{{ currency.symbol }}{{ microgonToMoneyNm(rules.rebiddingIncrementBy).format('0.00') }}
                      </div>
                      <div class="text-gray-500/60 text-md">
                        {{ rules.rebiddingDelay }} Minute After Loss
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
                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="seatGoals"
                      v-if="showEditBoxOverlay === 'seatGoals'"
                      @close="showEditBoxOverlay = null"
                      class="bottom-[-10px] left-0"
                    />
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.seatGoals, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay('seatGoals')" class="flex flex-col w-full h-full items-center justify-center px-8">
                      <div StatHeader>Seating Goal</div>
                      <div MainRule v-if="rules.seatGoalType === SeatGoalType.Max && rules.seatGoalCount === 0" class="w-full">
                        Disabled
                      </div>
                      <div MainRule v-else class="w-full">
                        {{ rules.seatGoalType }} {{ rules.seatGoalCount }} Per {{ rules.seatGoalInterval }}
                      </div>
                      <div class="text-gray-500/60 text-md">
                        Pursue First Available
                      </div>
                    </div>
                  </div>

                  <div class="w-[1px] bg-slate-300/80 mx-2"></div>

                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="expectedGrowth"
                      v-if="showEditBoxOverlay === 'expectedGrowth'"
                      @close="showEditBoxOverlay = null"
                      class="bottom-[-10px] left-1/2 -translate-x-1/2"
                    />
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.expectedGrowth, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay('expectedGrowth')" class="flex flex-col w-full h-full items-center justify-center">
                      <div StatHeader>Expected Growth</div>
                      <div class="flex flex-row items-center justify-center px-8 w-full text-center font-mono">
                        <div MainRule class="flex flex-row items-center justify-center w-5/12">
                          <span>{{ numeral(rules.argonCirculationGrowthPctMin).formatIfElse('0', '0', '+0.[00]') }}%</span>
                          <span class="text-md px-1.5 text-gray-500/60">to</span>
                          <span>{{ numeral(rules.argonCirculationGrowthPctMax).formatIfElse('0', '0', '+0.[00]')}}%</span>
                        </div>
                        <span class="text-md w-2/12 text-gray-500/60">&nbsp;and&nbsp;</span>
                        <div MainRule class="flex flex-row items-center justify-center w-5/12">
                          <span>{{ numeral(rules.micronotPriceChangePctMin).formatIfElse('0', '0', '+0.[00]') }}%</span>
                          <span class="text-md px-1.5 text-gray-500/60">to</span>
                          <span>{{ numeral(rules.micronotPriceChangePctMax).formatIfElse('0', '0', '+0.[00]')}}%</span>
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
                  
                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="cloudMachine"
                      v-if="showEditBoxOverlay === 'cloudMachine'"
                      @close="showEditBoxOverlay = null"
                      class="bottom-[-10px] right-0"
                    />
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.cloudMachine, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay('cloudMachine')" class="flex flex-col w-full h-full items-center justify-center px-8">
                      <div StatHeader>Cloud Machine</div>
                      <div MainRule class="tracking-widest w-full">
                        0.0.0.0
                      </div>
                      <div class="text-gray-500/60 text-md font-mono">
                        New Server
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div class="flex flex-row justify-end border-t border-slate-300 mx-4 py-4 space-x-4 rounded-b-lg">
              <div class="flex flex-row space-x-4 justify-center items-center">
                <ActiveBidsOverlayButton :loadFromMainchain="true" class="mr-10">
                  <span class="text-argon-600/70 cursor-pointer">Show Existing Mining Bids</span>
                </ActiveBidsOverlayButton>
                <button @click="cancelOverlay" class="border border-argon-button text-xl font-bold text-gray-500 px-7 py-1 rounded-md cursor-pointer">
                  <span>Cancel</span>
                </button>
                <button @click="saveRules" @mouseenter="showTooltip($event, tooltip.saveRules, { width: 'parent' })" @mouseleave="hideTooltip" class="bg-argon-button text-xl font-bold text-white px-7 py-1 rounded-md cursor-pointer">
                  <span v-if="!isSaving">{{ isBrandNew ? 'Create' : 'Update' }} Mining Bot</span>
                  <span v-else>{{ isBrandNew ? 'Creating' : 'Updating' }} Mining Bot...</span>
                </button>
              </div>
            </div>
          </div>
          <div v-else>Loading...</div>
        </div>
      </DialogPanel>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import emitter from '../emitters/basic';
import { Dialog, DialogPanel, TransitionRoot, TransitionChild } from '@headlessui/vue';
import { useConfig } from '../stores/config';
import { useCurrency } from '../stores/currency';
import numeral, { createNumeralHelpers } from '../lib/numeral';
import BgOverlay from '../components/BgOverlay.vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { showTooltip, hideTooltip } from '../lib/TooltipUtils';
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
import BigNumber from 'bignumber.js';
import { jsonParseWithBigInts, jsonStringifyWithBigInts } from '../lib/Utils';

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

const showEditBoxOverlay = Vue.ref<IEditBoxOverlayTypeForMining | null>(null);

const dialogPanel = Vue.ref(null);

const minimumAPY = Vue.ref(0);
const optimisticAPY = Vue.ref(0);

const startingBidAmount = Vue.ref(0n);
const finalBidAmount = Vue.ref(0n);

const tooltip = {
  capitalToCommit:
    'The more capital you put in, the more seats you have a chance to win and therefore the higher your earning potential.',
  estimatedAPYRange:
    'These estimates are based on the guaranteed block rewards locked on-chain combined with the bidding variables shown on this page.',
  startingBidAmount: `This is your starting bid price. Don't put it too low or you'll be forced to pay unneeded transaction fees in order to submit a rebid.`,
  rebiddingStrategy: Vue.computed(
    () =>
      `If your bids get knocked out of contention, your bot will wait ${rules.value.rebiddingDelay} minute${rules.value.rebiddingDelay === 1 ? '' : 's'} before submitting a new bid at ${currency.symbol}${microgonToMoneyNm(rules.value.rebiddingIncrementBy).format('0.00')} above the current winning bid.`,
  ),
  maximumBid: `Your mining bot will never submit a bid above this price. If other bidders go higher than this, you will be knocked out of contention.`,
  seatGoals: Vue.computed(() => {
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

function openEditBoxOverlay(type: IEditBoxOverlayTypeForMining) {
  showEditBoxOverlay.value = type;
}

function cancelOverlay() {
  isOpen.value = false;
  hideTooltip();

  if (previousBiddingRules) {
    config.biddingRules = jsonParseWithBigInts(previousBiddingRules) as IBiddingRules;
  }
}

function calculateMicronotsRequired(): bigint {
  let possibleSeats = Math.ceil(
    BigNumber(rules.value.requiredMicrogons).dividedBy(calculatorData.previousDayMidBid).toNumber(),
  );

  if (rules.value?.seatGoalType === SeatGoalType.Max) {
    possibleSeats = Math.min(possibleSeats, rules.value.seatGoalCount);
  }

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

function updateAPYs() {
  calculator.setConfig({
    argonCirculationGrowthPctMin: rules.value.argonCirculationGrowthPctMin,
    argonCirculationGrowthPctMax: rules.value.argonCirculationGrowthPctMax,
    micronotPriceChangePctMin: rules.value.micronotPriceChangePctMin,
    micronotPriceChangePctMax: rules.value.micronotPriceChangePctMax,
    startingBidAmount: {
      formulaType: rules.value.startingBidAmountFormulaType,
      adjustmentType: rules.value.startingBidAmountAdjustmentType,
      custom: rules.value.startingBidAmountCustom,
      absolute: rules.value.startingBidAmountAbsolute,
      relative: rules.value.startingBidAmountRelative,
    },
    finalBidAmount: {
      formulaType: rules.value.finalBidAmountFormulaType,
      adjustmentType: rules.value.finalBidAmountAdjustmentType,
      custom: rules.value.finalBidAmountCustom,
      absolute: rules.value.finalBidAmountAbsolute,
      relative: rules.value.finalBidAmountRelative,
    },
  });
  optimisticAPY.value = calculator.optimisticAPY;
  minimumAPY.value = calculator.minimumAPY;

  startingBidAmount.value = calculator.startingBid;
  finalBidAmount.value = calculator.finalBid;
}

Vue.watch(rules, updateAPYs, { deep: true, immediate: true });

emitter.on('openConfigureMiningBotOverlay', async () => {
  if (isOpen.value) return;
  isLoaded.value = false;
  isOpen.value = true;

  isBrandNew.value = !config.hasSavedBiddingRules;
  calculatorData.isInitialized.then(() => {
    previousBiddingRules = jsonStringifyWithBigInts(config.biddingRules);
    updateAPYs();
    isLoaded.value = true;
  });
});
</script>

<style scoped>
@reference "../main.css";

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
    @apply bg-gradient-to-b from-argon-menu-bg to-transparent;
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
  }
}
</style>
