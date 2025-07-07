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
          style="
            box-shadow:
              0px -1px 2px 0 rgba(0, 0, 0, 0.1),
              inset 0 2px 0 rgba(255, 255, 255, 1);
          "
        >
          <div
            v-if="showEditBoxOverlay"
            @click="showEditBoxOverlay = null"
            class="absolute top-0 left-0 w-full h-full z-40 bg-white/60"
          ></div>
          <div v-if="isLoaded" class="flex flex-col h-full w-full">
            <h2
              class="relative text-3xl font-bold text-left border-b border-slate-300 pt-5 pb-4 pl-3 mx-4 cursor-pointer text-[#672D73]"
              style="box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1)"
            >
              {{ isBrandNew ? 'Create' : 'Update' }} Personal Mining Bot
              <div
                @click="closeOverlay"
                class="absolute top-[22px] right-[0px] z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/70 hover:bg-[#D6D9DF]"
              >
                <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
              </div>
            </h2>

            <div class="flex flex-col grow relative w-full">
              <p class="opacity-80 font-light py-6 pl-10 pr-[6%]">
                This screen encapsulates the variables needed to manage your Argon mining. We've set basic defaults, but
                feel free to adjust. Commander's built-in bidding bot will use these configuration settings to make
                decisions and place bids on your behalf.
              </p>

              <section
                class="flex flex-row border-t border-b border-slate-300 text-center space-x-10 pt-10 pb-12 px-5 mx-5"
              >
                <div class="w-1/2">
                  <header class="text-lg font-bold text-slate-500/70 pb-2">Capital to Commit</header>
                  <div
                    class="border border-slate-500/30 rounded-lg py-9 text-4xl font-bold font-mono text-argon-600 shadow-sm"
                  >
                    {{ currency.symbol }}{{ microgonToMoneyNm(capitalToCommit).format('0,0.00') }}
                  </div>
                  <div class="pt-3 text-argon-600/70 cursor-pointer">
                    View Seat Probabilities ({{ currency.symbol
                    }}{{ microgonToMoneyNm(startingBidAmount).format('0,0.00') }}
                    to
                    {{ currency.symbol }}{{ microgonToMoneyNm(finalBidAmount).format('0,0.00') }}
                    per seat)
                  </div>
                </div>
                <div class="w-1/2">
                  <header class="text-lg font-bold text-slate-500/70 pb-2">Estimated APY Range</header>
                  <div
                    class="border border-slate-500/30 rounded-lg py-9 text-4xl font-bold font-mono text-argon-600 shadow-sm"
                  >
                    {{ numeral(optimisticAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 9_999) }}%
                    <span class="text-slate-500/80 font-normal text-xl relative -top-1 -mx-2">to</span>
                    {{ numeral(minimumAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 9_999) }}%
                  </div>
                  <div class="pt-3 text-argon-600/70 cursor-pointer">View Risk Analysis (100% server operations)</div>
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
                    <div
                      @click="openEditBoxOverlay('startingBidAmount')"
                      class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer"
                    >
                      <div class="font-bold text-slate-500/50">Starting Bid</div>
                      <span class="text-argon-600 font-mono font-bold">
                        <span v-if="startingBidAmountFormulaType !== BidAmountFormulaType.Custom">
                          {{ startingBidAmountFormulaType }}
                        </span>
                        <template v-if="startingBidAmountAdjustmentType === BidAmountAdjustmentType.Absolute">
                          <span v-if="startingBidAmountAbsolute">
                            <span v-if="startingBidAmountFormulaType !== BidAmountFormulaType.Custom">
                              {{ startingBidAmountAbsolute > 0 ? '+' : '-' }}
                            </span>
                            {{ currency.symbol
                            }}{{
                              microgonToMoneyNm(
                                startingBidAmountAbsolute < 0n ? -startingBidAmountAbsolute : startingBidAmountAbsolute,
                              ).format('0.00')
                            }}
                          </span>
                        </template>
                        <template v-else>
                          <span v-if="startingBidAmountRelative">
                            <span v-if="startingBidAmountFormulaType !== BidAmountFormulaType.Custom">
                              &nbsp;{{ startingBidAmountAbsolute > 0 ? '+' : '-' }}
                            </span>
                            {{ numeral(Math.abs(startingBidAmountRelative)).format('0.[00]') }}%
                          </span>
                        </template>
                        <InfoOutlineIcon
                          class="w-4 h-4 text-slate-500/70 inline-block ml-1 left-1 relative top-[-1px]"
                        />
                      </span>
                    </div>
                  </div>
                  <div class="w-[1px] bg-slate-300 mx-2"></div>
                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="rebiddingStrategy"
                      v-if="showEditBoxOverlay === 'rebiddingStrategy'"
                      @close="showEditBoxOverlay = null"
                      class="-top-5 left-1/2 -translate-x-1/2"
                    />
                    <div
                      @click="openEditBoxOverlay('rebiddingStrategy')"
                      class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer"
                    >
                      <div class="font-bold text-slate-500/50">Rebid Strategy</div>
                      <span class="text-argon-600 font-mono font-bold">
                        +{{ currency.symbol }}{{ microgonToMoneyNm(rebiddingIncrementBy).format('0.00') }} @
                        {{ rebiddingDelay }}min
                        <InfoOutlineIcon
                          class="w-4 h-4 text-slate-500/70 inline-block ml-1 left-1 relative top-[-1px]"
                        />
                      </span>
                    </div>
                  </div>
                  <div class="w-[1px] bg-slate-300 mx-2"></div>
                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="maximumBid"
                      v-if="showEditBoxOverlay === 'maximumBid'"
                      @close="showEditBoxOverlay = null"
                      class="-top-5 right-0"
                    />
                    <div
                      @click="openEditBoxOverlay('maximumBid')"
                      class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer"
                    >
                      <div class="font-bold text-slate-500/50">Maximum Bid</div>
                      <span class="text-argon-600 font-mono font-bold">
                        <span v-if="finalBidAmountFormulaType !== BidAmountFormulaType.Custom">
                          {{ finalBidAmountFormulaType }}
                        </span>
                        <template v-if="finalBidAmountAdjustmentType === BidAmountAdjustmentType.Absolute">
                          <span v-if="finalBidAmountAbsolute">
                            <span v-if="finalBidAmountFormulaType !== BidAmountFormulaType.Custom">
                              {{ finalBidAmountAbsolute > 0 ? '+' : '-' }}
                            </span>
                            {{ currency.symbol
                            }}{{ microgonToMoneyNm(bigIntAbs(finalBidAmountAbsolute)).format('0.00') }}
                          </span>
                        </template>
                        <template v-else>
                          <span v-if="finalBidAmountRelative">
                            <span v-if="finalBidAmountFormulaType !== BidAmountFormulaType.Custom">
                              &nbsp;{{ finalBidAmountRelative > 0 ? '+' : '-' }}
                            </span>
                            {{ numeral(Math.abs(finalBidAmountRelative)).format('0.[00]') }}%
                          </span>
                        </template>
                        <InfoOutlineIcon
                          class="w-4 h-4 text-slate-500/70 inline-block ml-1 left-1 relative top-[-1px]"
                        />
                      </span>
                    </div>
                  </div>
                </section>

                <div class="flex flex-row h-[1px]">
                  <div class="w-1/3 bg-slate-300"></div>
                  <div class="w-[1px] mx-2"></div>
                  <div class="w-1/3 bg-slate-300"></div>
                  <div class="w-[1px] mx-2"></div>
                  <div class="w-1/3 bg-slate-300"></div>
                </div>

                <section class="flex flex-row h-1/2 my-2">
                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="seatGoals"
                      v-if="showEditBoxOverlay === 'seatGoals'"
                      @close="showEditBoxOverlay = null"
                      class="bottom-[-10px] left-0"
                    />
                    <div
                      @click="openEditBoxOverlay('seatGoals')"
                      class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer"
                    >
                      <div class="font-bold text-slate-500/50">Seat Goals</div>
                      <span v-if="seatGoalType === SeatGoalType.Max && seatGoalCount === 0" class="text-argon-600 font-mono font-bold">
                        Disabled
                      </span>
                      <span v-else class="text-argon-600 font-mono font-bold">
                        {{ seatGoalType }} {{ seatGoalCount }} Per {{ seatGoalInterval }}
                        <InfoOutlineIcon
                          class="w-4 h-4 text-slate-500/70 inline-block ml-1 left-1 relative top-[-1px]"
                        />
                      </span>
                    </div>
                  </div>
                  <div class="w-[1px] bg-slate-300 mx-2"></div>
                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="operationalLongevity"
                      v-if="showEditBoxOverlay === 'operationalLongevity'"
                      @close="showEditBoxOverlay = null"
                      class="bottom-[-10px] left-1/2 -translate-x-1/2"
                    />
                    <div
                      @click="openEditBoxOverlay('operationalLongevity')"
                      class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer"
                    >
                      <div class="font-bold text-slate-500/50">Token Growth Changes</div>
                      <span class="text-argon-600 font-mono font-bold">
                        <span>
                          <span class="font-light">(</span>{{ numeral(micronotPriceChangePctMin).formatIfElse('0', '0', '+0.[00]') }}%,{{
                            numeral(micronotPriceChangePctMax).formatIfElse('0', '0', '+0.[00]')
                          }}%<span class="font-light">)</span>
                        </span>
                        <span class="font-light">&nbsp;&amp;&nbsp;</span>
                        <span>
                          <span class="font-light">(</span>{{ numeral(argonCirculationGrowthPctMin).formatIfElse('0', '0', '+0.[00]') }}%,{{
                            numeral(argonCirculationGrowthPctMax).formatIfElse('0', '0', '+0.[00]')
                          }}%<span class="font-light">)</span>
                        </span>
                        <InfoOutlineIcon
                          class="w-4 h-4 text-slate-500/70 inline-block ml-1 left-1 relative top-[-1px]"
                        />
                      </span>
                    </div>
                  </div>
                  <div class="w-[1px] bg-slate-300 mx-2"></div>
                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="cloudMachine"
                      v-if="showEditBoxOverlay === 'cloudMachine'"
                      @close="showEditBoxOverlay = null"
                      class="bottom-[-10px] right-0"
                    />
                    <div
                      @click="openEditBoxOverlay('cloudMachine')"
                      class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer"
                    >
                      <div class="font-bold text-slate-500/50">Cloud Machine</div>
                      <span class="text-argon-600 font-mono font-bold">
                        ProvisionNewServer
                        <InfoOutlineIcon
                          class="w-4 h-4 text-slate-500/70 inline-block ml-1 left-1 relative top-[-1px]"
                        />
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div class="flex flex-row justify-end border-t border-slate-300 mx-4 py-4 space-x-4 rounded-b-lg">
              <div class="flex flex-row space-x-4 justify-center items-center">
                <span class="text-argon-600/70 cursor-pointer">View Existing Mining Bids</span>
                <button
                  @click="closeOverlay"
                  class="border border-argon-button text-xl font-bold text-gray-500 px-7 py-1 rounded-md cursor-pointer"
                >
                  <span>Cancel</span>
                </button>
                <button
                  @click="saveRules"
                  class="bg-argon-button text-xl font-bold text-white px-7 py-1 rounded-md cursor-pointer"
                >
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
import InfoOutlineIcon from '../assets/info-outline.svg?component';
import EditBoxOverlay, { type IEditBoxOverlayTypeForMining } from './EditBoxOverlay.vue';
import BiddingCalculator, { BiddingCalculatorData, type IBiddingRules } from '@argonprotocol/commander-calculator';
import { getMainchain } from '../stores/mainchain';
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

const isBrandNew = Vue.ref(config.biddingRules === null);
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

function openEditBoxOverlay(type: IEditBoxOverlayTypeForMining) {
  showEditBoxOverlay.value = type;
}

function closeOverlay() {
  isOpen.value = false;
}

function calculateMicronotsRequired(): bigint {
  let possibleSeats = Math.ceil(BigNumber(capitalToCommit.value).dividedBy(calculatorData.previousDayMidBid).toNumber());

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

    argonCirculationGrowthPctMin.value = biddingRules?.argonCirculationGrowthPctMin || argonCirculationGrowthPctMin.value;
    argonCirculationGrowthPctMax.value = biddingRules?.argonCirculationGrowthPctMax || argonCirculationGrowthPctMax.value;

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
    finalBidAmountAdjustmentType.value = biddingRules?.finalBidAmountAdjustmentType || finalBidAmountAdjustmentType.value;
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
</style>
