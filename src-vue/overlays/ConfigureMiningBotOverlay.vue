<!-- prettier-ignore -->
<template>
  <TransitionRoot class="absolute inset-0 z-10" :show="isOpen">
    <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
      <BgOverlay @close="closeOverlay" />
    </TransitionChild>
    <Dialog @close="closeOverlay" :initialFocus="dialogPanel">
      <DialogPanel class="absolute top-0 left-0 right-0 bottom-0 z-10">
        <div
          ref="dialogPanel"
          class="absolute top-[40px] left-3 right-3 bottom-3 flex flex-col overflow-hidden rounded-md border border-black/30 inner-input-shadow bg-argon-menu-bg text-left transition-all"
          style="box-shadow: 0px -1px 2px 0 rgba(0, 0, 0, 0.1), inset 0 2px 0 rgba(255, 255, 255, 1);">
          <div v-if="showEditBoxOverlay" @click="showEditBoxOverlay = null" class="absolute top-0 left-0 w-full h-full z-40 bg-white/60"></div>
          <div v-if="isLoaded" class="flex flex-col h-full w-full">
            <h2
              class="relative text-3xl font-bold text-left border-b border-slate-300 pt-5 pb-4 pl-3 mx-4 cursor-pointer text-[#672D73]"
              style="box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1)"
            >
              {{ isBrandNew ? 'Create' : 'Update' }} Personal Mining Bot
              <div @click="closeOverlay" class="absolute top-[22px] right-[0px] z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/70 hover:bg-[#D6D9DF]">
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
                      {{ currency.symbol }}{{ microgonToMoneyNm(capitalToCommit).format('0,0.[00]') }}
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
                      {{ numeral(optimisticAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 9_999) }}%
                      <span class="text-slate-500/80 font-normal text-xl relative -top-1 -mx-2">to</span>
                      {{ numeral(minimumAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 9_999) }}%
                    </div>
                  </div>
                  <div class="pt-3 text-argon-600/70 cursor-pointer text-md">View Risk Analysis (99% from server ops)</div>
                </div>
              </section>

              <div class="flex flex-col relative grow px-5 text-lg">
                <section class="flex flex-row h-1/2 my-2">
                  
                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="startingBidAmount"
                      v-if="showEditBoxOverlay === 'startingBidAmount'"
                      @close="showEditBoxOverlay = null"
                      class="-top-5 left-0"
                    />
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.startingBidAmount, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay('startingBidAmount')" class="flex flex-col w-full h-full items-center justify-center px-8">
                      <div StatHeader>Starting Bid</div>
                      <div MainRule class="w-full">
                        {{ currency.symbol }}{{ microgonToMoneyNm(startingBidAmount).format('0,0.00') }}
                      </div>
                      <div class="text-gray-500/60 text-md">
                        <span v-if="startingBidAmountFormulaType === BidAmountFormulaType.Custom">Hardcoded Value</span>
                        <template v-else>
                          <span>{{ startingBidAmountFormulaType }}</span>
                          <span v-if="startingBidAmountAdjustmentType === BidAmountAdjustmentType.Absolute && startingBidAmountAbsolute">
                            {{ startingBidAmountAbsolute > 0 ? '+' : '-' 
                            }}{{ currency.symbol
                            }}{{
                              microgonToMoneyNm(
                                startingBidAmountAbsolute < 0n ? -startingBidAmountAbsolute : startingBidAmountAbsolute,
                              ).format('0.00')
                            }}
                          </span>
                          <span v-else-if="startingBidAmountRelative">
                            {{ startingBidAmountAbsolute > 0 ? '+' : '-' 
                            }}{{ numeral(Math.abs(startingBidAmountRelative)).format('0.[00]') }}%
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
                      class="-top-5 left-1/2 -translate-x-1/2"
                    />
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.rebiddingStrategy, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay('rebiddingStrategy')" class="flex flex-col w-full h-full items-center justify-center px-8">
                      <div StatHeader>Rebidding Strategy</div>
                      <div MainRule class="w-full">
                        +{{ currency.symbol }}{{ microgonToMoneyNm(rebiddingIncrementBy).format('0.00') }}
                      </div>
                      <div class="text-gray-500/60 text-md">
                        {{ rebiddingDelay }} Minute After Loss
                      </div>
                    </div>
                  </div>
                  
                  <div class="w-[1px] bg-slate-300/80 mx-2"></div>

                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="maximumBid"
                      v-if="showEditBoxOverlay === 'maximumBid'"
                      @close="showEditBoxOverlay = null"
                      class="-top-5 right-0"
                    />
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.maximumBid, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay('maximumBid')" class="flex flex-col w-full h-full items-center justify-center px-8">
                      <div StatHeader>Maximum Bid</div>
                      <div MainRule class="w-full">
                        {{ currency.symbol }}{{ microgonToMoneyNm(finalBidAmount).format('0,0.00') }}
                      </div>
                      <div class="text-gray-500/60 text-md">
                        <span v-if="finalBidAmountFormulaType === BidAmountFormulaType.Custom">Hardcoded Value</span>
                        <template v-else>
                          <span>{{ finalBidAmountFormulaType }}</span>                        
                          <span v-if="finalBidAmountAdjustmentType === BidAmountAdjustmentType.Absolute && finalBidAmountAbsolute">
                            {{ finalBidAmountAbsolute > 0 ? '+' : '-' 
                            }}{{ currency.symbol
                            }}{{ microgonToMoneyNm(bigIntAbs(finalBidAmountAbsolute)).format('0.00') }}
                          </span>
                          <span v-else-if="finalBidAmountRelative">
                            &nbsp;{{ finalBidAmountRelative > 0 ? '+' : '-' 
                            }}{{ numeral(Math.abs(finalBidAmountRelative)).format('0.[00]') }}%
                          </span>
                        </template>
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
                      <div MainRule v-if="seatGoalType === SeatGoalType.Max && seatGoalCount === 0" class="w-full">
                        Disabled
                      </div>
                      <div MainRule v-else class="w-full">
                        {{ seatGoalType }} {{ seatGoalCount }} Per {{ seatGoalInterval }}
                      </div>
                      <div class="text-gray-500/60 text-md">
                        Pursue First Available
                      </div>
                    </div>
                  </div>

                  <div class="w-[1px] bg-slate-300/80 mx-2"></div>

                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="operationalLongevity"
                      v-if="showEditBoxOverlay === 'operationalLongevity'"
                      @close="showEditBoxOverlay = null"
                      class="bottom-[-10px] left-1/2 -translate-x-1/2"
                    />
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.operationalLongevity, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay('operationalLongevity')" class="flex flex-col w-full h-full items-center justify-center">
                      <div StatHeader>Expected Growth</div>
                      <div class="flex flex-row items-center justify-center px-8 w-full text-center font-mono">
                        <div MainRule class="flex flex-row items-center justify-center w-5/12">
                          <span>{{ numeral(argonCirculationGrowthPctMin).formatIfElse('0', '0', '+0.[00]') }}%</span>
                          <span class="text-md px-1.5 text-gray-500/60">to</span>
                          <span>{{ numeral(argonCirculationGrowthPctMax).formatIfElse('0', '0', '+0.[00]')}}%</span>
                        </div>
                        <span class="text-md w-2/12 text-gray-500/60">&nbsp;and&nbsp;</span>
                        <div MainRule class="flex flex-row items-center justify-center w-5/12">
                          <span>{{ numeral(micronotPriceChangePctMin).formatIfElse('0', '0', '+0.[00]') }}%</span>
                          <span class="text-md px-1.5 text-gray-500/60">to</span>
                          <span>{{ numeral(micronotPriceChangePctMax).formatIfElse('0', '0', '+0.[00]')}}%</span>
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
                <button @click="closeOverlay" class="border border-argon-button text-xl font-bold text-gray-500 px-7 py-1 rounded-md cursor-pointer">
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
import BiddingCalculator, { BiddingCalculatorData, type IBiddingRules } from '@argonprotocol/commander-calculator';
import { getMainchain } from '../stores/mainchain';
import ActiveBidsOverlayButton from './ActiveBidsOverlayButton.vue';
import {
  BidAmountAdjustmentType,
  BidAmountFormulaType,
  MicronotPriceChangeType,
  SeatGoalInterval,
  SeatGoalType,
} from '@argonprotocol/commander-calculator/src/IBiddingRules.ts';
import { MICROGONS_PER_ARGON as MICROGONS_PER_ARGON_MAINCHAIN } from '@argonprotocol/mainchain';
import { bigIntAbs } from '@argonprotocol/commander-calculator/src/utils';
import BigNumber from 'bignumber.js';

const MICROGONS_PER_ARGON = BigInt(MICROGONS_PER_ARGON_MAINCHAIN);

const currency = useCurrency();
const config = useConfig();
const { microgonToMoneyNm } = createNumeralHelpers(currency);

const isBrandNew = Vue.ref<boolean>(!config.biddingRules);
const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);
const isSaving = Vue.ref(false);

const showEditBoxOverlay = Vue.ref<IEditBoxOverlayTypeForMining | null>(null);

const dialogPanel = Vue.ref(null);
const calculatorData = new BiddingCalculatorData(getMainchain());
const calculator = new BiddingCalculator(calculatorData);

const capitalToCommit = Vue.ref(1_000n * MICROGONS_PER_ARGON);

const minimumAPY = Vue.ref(0);
const optimisticAPY = Vue.ref(0);

const startingBidAmount = Vue.ref(0n);
const finalBidAmount = Vue.ref(0n);

// Estimated Circulation
const argonCirculationGrowthPctMin = Vue.ref(0);
const argonCirculationGrowthPctMax = Vue.ref(0);

// Argonot Price Change
const micronotPriceChangeType = Vue.ref<IBiddingRules['micronotPriceChangeType']>(MicronotPriceChangeType.Between);
const micronotPriceChangePctMin = Vue.ref(0);
const micronotPriceChangePctMax = Vue.ref(0);

// Starting Amount
const startingBidAmountFormulaType = Vue.ref<IBiddingRules['startingBidAmountFormulaType']>(
  BidAmountFormulaType.Custom,
);
const startingBidAmountAdjustmentType = Vue.ref<IBiddingRules['startingBidAmountAdjustmentType']>(
  BidAmountAdjustmentType.Absolute,
);
const startingBidAmountAbsolute = Vue.ref<bigint>(700n * MICROGONS_PER_ARGON);
const startingBidAmountRelative = Vue.ref<number>(0);

// Rebidding
const rebiddingIncrementBy = Vue.ref(1n * MICROGONS_PER_ARGON);
const rebiddingDelay = Vue.ref(1);

// Final Amount
const finalBidAmountFormulaType = Vue.ref<IBiddingRules['finalBidAmountFormulaType']>(
  BidAmountFormulaType.MinimumBreakeven,
);
const finalBidAmountAdjustmentType = Vue.ref<IBiddingRules['finalBidAmountAdjustmentType']>(
  BidAmountAdjustmentType.Relative,
);
const finalBidAmountAbsolute = Vue.ref(0n);
const finalBidAmountRelative = Vue.ref(-1);

// Seat Goals
const seatGoalType = Vue.ref(SeatGoalType.Min);
const seatGoalInterval = Vue.ref(SeatGoalInterval.Epoch);
const seatGoalCount = Vue.ref(3);

const tooltip = {
  capitalToCommit:
    'The more you put in, the more seats you have a chance to win and therefore the higher your earning potential.',
  estimatedAPYRange:
    'These estimates are based on the guaranteed block rewards locked on-chain combined with the bidding variables shown on this page.',
  startingBidAmount: `This is the first bid price your bot will place. Don't start too low or you'll be forced to pay unneeded transaction fees in order to submit a rebid.`,
  rebiddingStrategy: Vue.computed(
    () =>
      `If your bids get knocked out of contention, your bot will wait ${rebiddingDelay.value} minute${rebiddingDelay.value === 1 ? '' : 's'} before submitting a new bid at ${currency.symbol}${microgonToMoneyNm(rebiddingIncrementBy.value).format('0.00')} above the current winning bid.`,
  ),
  maximumBid: `Your mining bot will never submit a bid above this price. If other bidders go higher than this, you will be knocked out of contention.`,
  seatGoals: Vue.computed(() => {
    let interval =
      seatGoalInterval.value === SeatGoalInterval.Epoch
        ? `An "epoch" is equivalent to 10 days`
        : `A "frame" is equivalent to 1 day`;
    return `This is your bot's goal, not its ceiling. ${interval}. If the bot can snag more than ${seatGoalCount.value} seats, it will do so. If it fails to achieve its goal, it will alert you.`;
  }),
  operationalLongevity: `These numbers don't affect your bot's decisions; they only factor into the Estimated APY shown above. Argons is growth in circulation; Argonots is change in token price. Both are annual.`,
  cloudMachine: `Leave this as-is. We'll guide you through setting up a new Cloud Machine on the next screen.`,
  saveRules: `Let's go! You can modify these settings later.`,
};

function openEditBoxOverlay(type: IEditBoxOverlayTypeForMining) {
  showEditBoxOverlay.value = type;
}

function closeOverlay() {
  hideTooltip();
  isOpen.value = false;
}

function calculateMicronotsRequired(): bigint {
  let possibleSeats = Math.ceil(
    BigNumber(capitalToCommit.value).dividedBy(calculatorData.previousDayMidBid).toNumber(),
  );

  if (seatGoalType.value === SeatGoalType.Max) {
    possibleSeats = Math.min(possibleSeats, seatGoalCount.value);
  }

  const totalMicronotsRequired = BigInt(possibleSeats) * calculatorData.micronotsRequiredForBid;

  // Ceil to the nearest million (argonot)
  return BigInt(Math.ceil(Number(totalMicronotsRequired) / 1_000_000) * 1_000_000);
}

async function saveRules() {
  isSaving.value = true;
  const rules: IBiddingRules = {
    argonCirculationGrowthPctMin: argonCirculationGrowthPctMin.value,
    argonCirculationGrowthPctMax: argonCirculationGrowthPctMax.value,

    micronotPriceChangeType: micronotPriceChangeType.value,
    micronotPriceChangePctMin: micronotPriceChangePctMin.value,
    micronotPriceChangePctMax: micronotPriceChangePctMax.value,

    startingBidAmountFormulaType: startingBidAmountFormulaType.value,
    startingBidAmountAdjustmentType: startingBidAmountAdjustmentType.value,
    startingBidAmountAbsolute: startingBidAmountAbsolute.value,
    startingBidAmountRelative: startingBidAmountRelative.value,

    rebiddingDelay: rebiddingDelay.value,
    rebiddingIncrementBy: rebiddingIncrementBy.value,

    finalBidAmountFormulaType: finalBidAmountFormulaType.value,
    finalBidAmountAdjustmentType: finalBidAmountAdjustmentType.value,
    finalBidAmountAbsolute: finalBidAmountAbsolute.value,
    finalBidAmountRelative: finalBidAmountRelative.value,

    seatGoalType: seatGoalType.value,
    seatGoalCount: seatGoalCount.value,
    seatGoalInterval: seatGoalInterval.value,

    requiredMicrogons: capitalToCommit.value,
    requiredMicronots: calculateMicronotsRequired(),
  };

  config.biddingRules = rules;
  await config.save();

  isSaving.value = false;
  closeOverlay();
}

function updateAPYs() {
  calculator.setConfig({
    argonCirculationGrowthPctMin: argonCirculationGrowthPctMin.value,
    argonCirculationGrowthPctMax: argonCirculationGrowthPctMax.value,
    micronotPriceChangePctMin: micronotPriceChangePctMin.value,
    micronotPriceChangePctMax: micronotPriceChangePctMax.value,
    startingBidAmount: {
      formulaType: startingBidAmountFormulaType.value,
      adjustmentType: startingBidAmountAdjustmentType.value,
      absolute: startingBidAmountAbsolute.value,
      relative: startingBidAmountRelative.value,
    },
    finalBidAmount: {
      formulaType: finalBidAmountFormulaType.value,
      adjustmentType: finalBidAmountAdjustmentType.value,
      absolute: finalBidAmountAbsolute.value,
      relative: finalBidAmountRelative.value,
    },
  });
  optimisticAPY.value = calculator.optimisticAPY;
  minimumAPY.value = calculator.minimumAPY;

  startingBidAmount.value = calculator.startingBid;
  finalBidAmount.value = calculator.finalBid;
}

emitter.on('openConfigureMiningBotOverlay', async () => {
  if (isOpen.value) return;
  isLoaded.value = false;
  isOpen.value = true;

  calculatorData.isInitialized.then(() => {
    const biddingRules = config.biddingRules || undefined;

    argonCirculationGrowthPctMin.value =
      biddingRules?.argonCirculationGrowthPctMin || argonCirculationGrowthPctMin.value;
    argonCirculationGrowthPctMax.value =
      biddingRules?.argonCirculationGrowthPctMax || argonCirculationGrowthPctMax.value;

    micronotPriceChangeType.value = biddingRules?.micronotPriceChangeType || micronotPriceChangeType.value;
    micronotPriceChangePctMin.value = biddingRules?.micronotPriceChangePctMin || micronotPriceChangePctMin.value;
    micronotPriceChangePctMax.value = biddingRules?.micronotPriceChangePctMax || micronotPriceChangePctMax.value;

    startingBidAmountFormulaType.value =
      biddingRules?.startingBidAmountFormulaType || startingBidAmountFormulaType.value;
    startingBidAmountAdjustmentType.value =
      biddingRules?.startingBidAmountAdjustmentType || startingBidAmountAdjustmentType.value;
    startingBidAmountAbsolute.value = biddingRules?.startingBidAmountAbsolute || startingBidAmountAbsolute.value;
    startingBidAmountRelative.value = biddingRules?.startingBidAmountRelative || startingBidAmountRelative.value;

    rebiddingIncrementBy.value = biddingRules?.rebiddingIncrementBy || rebiddingIncrementBy.value;
    rebiddingDelay.value = biddingRules?.rebiddingDelay || rebiddingDelay.value;

    finalBidAmountFormulaType.value = biddingRules?.finalBidAmountFormulaType || finalBidAmountFormulaType.value;
    finalBidAmountAdjustmentType.value =
      biddingRules?.finalBidAmountAdjustmentType || finalBidAmountAdjustmentType.value;
    finalBidAmountAbsolute.value = biddingRules?.finalBidAmountAbsolute || finalBidAmountAbsolute.value;
    finalBidAmountRelative.value = biddingRules?.finalBidAmountRelative || finalBidAmountRelative.value;

    seatGoalType.value = biddingRules?.seatGoalType || seatGoalType.value;
    seatGoalCount.value = biddingRules?.seatGoalCount || seatGoalCount.value;
    seatGoalInterval.value = biddingRules?.seatGoalInterval || seatGoalInterval.value;

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
