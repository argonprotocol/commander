<!-- prettier-ignore -->
<template>
  <TransitionRoot as="template" :show="isOpen" enter="ease-out duration-300" enter-from="opacity-0" enter-to="opacity-100">
    <Dialog @close="cancelOverlay" :initialFocus="dialogPanel">
      <DialogPanel class="ConfigureMiningBotOverlay absolute top-0 left-0 right-0 bottom-0 z-10 cursor-default">
        <BgOverlay @close="cancelOverlay" />
        <div
          ref="dialogPanel"
          class="absolute top-[40px] left-3 right-3 bottom-3 flex flex-col rounded-md border border-black/30 inner-input-shadow bg-argon-menu-bg text-left transition-all"
          style="box-shadow: 0px -1px 2px 0 rgba(0, 0, 0, 0.1), inset 0 2px 0 rgba(255, 255, 255, 1);">
          <BgOverlay v-if="showEditBoxOverlay" @close="showEditBoxOverlay = null" :showWindowControls="false" class="z-40 rounded-md" />
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

              <section class="flex flex-row border-t border-b border-slate-300 text-center pt-8 pb-8 px-5 mx-5 justify-stretch">
                <div class="w-1/2 flex flex-col grow">
                  <div @mouseenter="showTooltip($event, tooltip.capitalToCommit, { width: 'parent' })" @mouseleave="hideTooltip" class="flex flex-col grow group">
                    <header StatHeader class="bg-[#FAF9FA] border border-[#DDDCDD] rounded-t-lg group-hover:text-argon-600/70 relative z-10">Capital to Commit</header>
                    <div PrimaryStat class="grow relative border border-slate-500/30 rounded-lg mt-2 pb-12 pt-10 text-5xl font-bold font-mono text-argon-600 shadow-sm">
                      <InputArgon v-model="rules.requiredMicrogons" :min="10_000_000n" :alwaysShowDecimals="false" />
                    </div>
                  </div>
                  <div class="pt-3 text-argon-600/70 cursor-pointer text-md">
                    View Seat Probabilities (between {{ probableMinSeats }} and {{ probableMaxSeats }} seats)
                  </div>
                </div>
                <div class="flex flex-col items-center justify-center text-3xl mx-2 text-center">
                  <span class="relative -top-5 opacity-50">
                    =
                  </span>
                </div>
                <div class="w-1/2 flex flex-col grow">
                  <div @mouseenter="showTooltip($event, tooltip.estimatedAPYRange, { width: 'parent' })" @mouseleave="hideTooltip" class="flex flex-col grow group">
                    <header StatHeader class="bg-[#FAF9FA] border border-[#DDDCDD] rounded-t-lg relative z-10">Estimated APYs</header>
                    <div PrimaryStat class="grow flex flex-col border border-slate-500/30 rounded-lg mt-2 shadow-sm w-full">
                      <table class="w-full h-full relative z-50">
                        <thead>
                          <tr class="h-1/3">
                            <th></th>
                            <th class="font-light font-sans">Slow Growth</th>
                            <th class="font-light font-sans">Fast Growth</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr class="font-bold font-mono text-argon-600 h-1/3">
                            <td class="font-light font-sans">Maximum Bid</td>
                            <td>{{ numeral(maximumBidAtSlowGrowthAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 9_999) }}%</td>
                            <td>{{ numeral(maximumBidAtFastGrowthAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 9_999) }}%</td>
                          </tr>
                          <tr class="font-bold font-mono text-argon-600 h-1/3">
                            <td class="font-light font-sans">Minimum Bid</td>
                            <td>{{ numeral(minimumBidAtSlowGrowthAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 9_999) }}%</td>
                            <td>{{ numeral(minimumBidAtFastGrowthAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 9_999) }}%</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div class="pt-3 text-argon-600/70 cursor-pointer text-md">View Risk Analysis (it's 99% from server ops)</div>
                </div>
              </section>

              <div class="flex flex-col relative grow px-5 text-lg">
                <section class="flex flex-row h-1/2 my-2">

                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="minimumBid"
                      v-if="showEditBoxOverlay === 'minimumBid'"
                      @close="showEditBoxOverlay = null"
                      class="-top-5 left-0"
                    />
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.minimumBid, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay('minimumBid')" class="flex flex-col w-full h-full items-center justify-center px-8">
                      <div StatHeader>Starting Bid</div>
                      <div MainRule class="w-full">
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

                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="maximumBid"
                      v-if="showEditBoxOverlay === 'maximumBid'"
                      @close="showEditBoxOverlay = null"
                      class="-top-5 left-1/2 -translate-x-1/2"
                    />
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.maximumBid, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay('maximumBid')" class="flex flex-col w-full h-full items-center justify-center px-8">
                      <div StatHeader>Maximum Bid</div>
                      <div MainRule class="w-full">
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
                        {{ rules.seatGoalCount }} Per {{ rules.seatGoalInterval }}
                      </div>
                      <div class="text-gray-500/60 text-md">
                        {{ rules.seatGoalType === SeatGoalType.Max ? 'Stop After Goal Reached' : 'Get As Many As Possible' }}
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
                  
                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="cloudMachine"
                      v-if="showEditBoxOverlay === 'cloudMachine'"
                      :hideSaveButton="true"
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
                  <span v-if="!isSaving">{{ isBrandNew ? 'Create Mining Bot' : 'Update Settings' }}</span>
                  <span v-else>{{ isBrandNew ? 'Creating Mining Bot...' : 'Updating Settings...' }}</span>
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
import basicEmitter from '../emitters/basicEmitter';
import { Dialog, DialogPanel, TransitionRoot, TransitionChild } from '@headlessui/vue';
import { useConfig } from '../stores/config';
import { useCurrency } from '../stores/currency';
import numeral, { createNumeralHelpers } from '../lib/numeral';
import BgOverlay from '../components/BgOverlay.vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
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
import BigNumber from 'bignumber.js';
import { jsonParseWithBigInts, jsonStringifyWithBigInts } from '@argonprotocol/commander-calculator';
import InputArgon from '../components/InputArgon.vue';

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

const probableMinSeats = Vue.ref(0);
const probableMaxSeats = Vue.ref(0);

const minimumBidAmount = Vue.ref(0n);
const maximumBidAmount = Vue.ref(0n);

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
  if (showEditBoxOverlay.value) return;
  isOpen.value = false;
  hideTooltip();
  console.log('SHOW OVERLAY', isOpen.value);

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

function showTooltip(
  event: MouseEvent,
  label: string | Vue.ComputedRef<string>,
  flags: { width?: 'parent'; widthPlus?: number } = {},
) {
  if (showEditBoxOverlay.value) return;
  showTooltipOriginal(event, label, flags);
}

function updateAPYs() {
  calculator.updateBiddingRules(rules.value);

  minimumBidAmount.value = calculator.minimumBidAmount;
  maximumBidAmount.value = calculator.maximumBidAmount;

  minimumBidAtSlowGrowthAPY.value = calculator.minimumBidAtSlowGrowthAPY;
  minimumBidAtFastGrowthAPY.value = calculator.minimumBidAtFastGrowthAPY;
  maximumBidAtSlowGrowthAPY.value = calculator.maximumBidAtSlowGrowthAPY;
  maximumBidAtFastGrowthAPY.value = calculator.maximumBidAtFastGrowthAPY;

  const probableMinSeatsBn = BigNumber(rules.value.requiredMicrogons).dividedBy(calculator.maximumBidAmount);
  probableMinSeats.value = Math.max(probableMinSeatsBn.integerValue().toNumber(), 0);

  const probableMaxSeatsBn = BigNumber(rules.value.requiredMicrogons).dividedBy(calculator.minimumBidAmount);
  probableMaxSeats.value = Math.min(probableMaxSeatsBn.integerValue().toNumber(), calculatorData.miningSeatCount);
}

Vue.watch(rules, updateAPYs, { deep: true });

basicEmitter.on('openConfigureMiningBotOverlay', async () => {
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

<style>
@reference "../main.css";

.ConfigureMiningBotOverlay {
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
