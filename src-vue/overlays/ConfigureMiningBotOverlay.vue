<template>
  <TransitionRoot
    :show="isOpen"
    as="template"
    enter="duration-300 ease-out"
    enter-from="opacity-0"
    enter-to="opacity-100"
    leave="duration-200 ease-in"
    leave-from="opacity-100"
    leave-to="opacity-0"
  >
    <Dialog @close="maybeCloseOverlay" :initialFocus="dialogPanel">
      <DialogPanel class="absolute top-0 left-0 right-0 bottom-0 z-10">
        <BgOverlay @close="maybeCloseOverlay" />
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
              Configure Mining Bot
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
                  <header class="text-lg font-bold text-slate-500/70 pb-2">Maximum Investment</header>
                  <div
                    class="border border-slate-500/30 rounded-lg py-5 text-4xl font-bold font-mono text-argon-600 shadow-sm"
                  >
                    $1,000
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
                    class="border border-slate-500/30 rounded-lg py-5 text-4xl font-bold font-mono text-argon-600 shadow-sm"
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
                      id="rebidStrategy"
                      v-if="showEditBoxOverlay === 'rebidStrategy'"
                      @close="showEditBoxOverlay = null"
                      class="-top-5 left-1/2 -translate-x-1/2"
                    />
                    <div
                      @click="openEditBoxOverlay('rebidStrategy')"
                      class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer"
                    >
                      <div class="font-bold text-slate-500/50">Rebid Strategy</div>
                      <span class="text-argon-600 font-mono font-bold">
                        +{{ currency.symbol }}{{ microgonToMoneyNm(incrementAmount).format('0.00') }} @
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
                      id="throttleStrategy"
                      v-if="showEditBoxOverlay === 'throttleStrategy'"
                      @close="showEditBoxOverlay = null"
                      class="bottom-[-10px] left-0"
                    />
                    <div
                      @click="openEditBoxOverlay('throttleStrategy')"
                      class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer"
                    >
                      <div class="font-bold text-slate-500/50">Throttle Strategy</div>
                      <span class="text-argon-600 font-mono font-bold">
                        <span v-if="disableBotType === DisableBotType.Never">ContinuousDistribution</span>
                        <span v-else-if="disableBotType === DisableBotType.AfterFirstSeat">SingleSeat</span>
                        <span v-else-if="disableBotType === DisableBotType.AfterFirstSlot">SingleFrame</span>
                        <span v-else>Unknown</span>
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
                          ({{ numeral(micronotPriceChangePctMin).formatIfElse('0', '0', '+0.[00]') }}%,{{
                            numeral(micronotPriceChangePctMax).formatIfElse('0', '0', '+0.[00]')
                          }}%)
                        </span>
                        <span>&</span>
                        <span>
                          ({{ numeral(argonCirculationGrowthPctMin).formatIfElse('0', '0', '+0.[00]') }}%,{{
                            numeral(argonCirculationGrowthPctMax).formatIfElse('0', '0', '+0.[00]')
                          }}%)
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
                <span class="text-argon-600/70 cursor-pointer">View Active Bids</span>
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
                  <span v-if="!isSaving">{{ hasExistingRules ? 'Update' : 'Save' }} Miner</span>
                  <span v-else>{{ hasExistingRules ? 'Updating' : 'Saving' }} Miner...</span>
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
import dayjs from 'dayjs';
import emitter from '../emitters/basic';
import { Dialog, DialogPanel, TransitionRoot } from '@headlessui/vue';
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
  DisableBotType,
  BidAmountFormulaType,
  MicronotPriceChangeType,
} from '@argonprotocol/commander-calculator/src/IBiddingRules.ts';
import { MICROGONS_PER_ARGON as MICROGONS_PER_ARGON_MAINCHAIN } from '@argonprotocol/mainchain';
import { bigIntAbs } from '@argonprotocol/commander-calculator/src/utils';

const MICROGONS_PER_ARGON = BigInt(MICROGONS_PER_ARGON_MAINCHAIN);

const currency = useCurrency();
const config = useConfig();
const { microgonToArgonNm, microgonToMoneyNm } = createNumeralHelpers(currency);

const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);
const isSaving = Vue.ref(false);

const hasExistingRules = Vue.ref(false);
const showEditBoxOverlay = Vue.ref<IEditBoxOverlayTypeForMining | null>(null);

const dialogPanel = Vue.ref(null);
const calculatorData = new BiddingCalculatorData(getMainchain());
const calculator = new BiddingCalculator(calculatorData);

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
  BidAmountFormulaType.PreviousDayMid,
);
const startingBidAmountAdjustmentType = Vue.ref<IBiddingRules['startingBidAmountAdjustmentType']>(
  BidAmountAdjustmentType.Absolute,
);
const startingBidAmountAbsolute = Vue.ref<bigint>(0n * MICROGONS_PER_ARGON);
const startingBidAmountRelative = Vue.ref<number>(0);

// Rebidding
const incrementAmount = Vue.ref(1n * MICROGONS_PER_ARGON);
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

// Throttles
const throttleSeats = Vue.ref(false);
const throttleSeatCount = Vue.ref(1);
const throttleSpending = Vue.ref(false);
const throttleSpendingAmount = Vue.ref(0n);
const throttleDistributeEvenly = Vue.ref(false);

// Disable
const disableBotType: Vue.Ref<DisableBotType> = Vue.ref(DisableBotType.Never);

let openedAt = dayjs();

function openEditBoxOverlay(type: IEditBoxOverlayTypeForMining) {
  showEditBoxOverlay.value = type;
}

function maybeCloseOverlay() {
  const secondsSinceOpened = dayjs().diff(openedAt, 'seconds');
  if (secondsSinceOpened < 2) {
    closeOverlay();
  }
}

function closeOverlay() {
  isOpen.value = false;
}

function saveRules() {
  console.log('saveRules');
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
  minimumAPY.value = calculator.minimumAPY;
  optimisticAPY.value = calculator.optimisticAPY;

  startingBidAmount.value = calculator.startingBid;
  finalBidAmount.value = calculator.finalBid;
}

emitter.on('openConfigureMiningBotOverlay', async () => {
  if (isOpen.value) return;
  isLoaded.value = false;
  openedAt = dayjs();
  isOpen.value = true;

  calculatorData.isInitialized.then(() => {
    const biddingRules = config.biddingRules || undefined;
    hasExistingRules.value = !!biddingRules;

    micronotPriceChangeType.value = biddingRules?.micronotPriceChangeType || micronotPriceChangeType.value;
    micronotPriceChangePctMin.value = biddingRules?.micronotPriceChangePctMin || micronotPriceChangePctMin.value;
    micronotPriceChangePctMax.value = biddingRules?.micronotPriceChangePctMax || micronotPriceChangePctMax.value;

    startingBidAmountFormulaType.value =
      biddingRules?.startingBidAmountFormulaType || startingBidAmountFormulaType.value;
    startingBidAmountAdjustmentType.value =
      biddingRules?.startingBidAmountAdjustmentType || startingBidAmountAdjustmentType.value;
    startingBidAmountAbsolute.value = biddingRules?.startingBidAmountAbsolute || startingBidAmountAbsolute.value;
    startingBidAmountRelative.value = biddingRules?.startingBidAmountRelative || startingBidAmountRelative.value;

    incrementAmount.value = biddingRules?.incrementAmount || incrementAmount.value;
    rebiddingDelay.value = biddingRules?.rebiddingDelay || rebiddingDelay.value;

    finalBidAmountFormulaType.value = biddingRules?.finalBidAmountFormulaType || finalBidAmountFormulaType.value;
    finalBidAmountAbsolute.value = biddingRules?.finalBidAmountAbsolute || finalBidAmountAbsolute.value;
    finalBidAmountRelative.value = biddingRules?.finalBidAmountRelative || finalBidAmountRelative.value;

    throttleSeats.value = biddingRules?.throttleSeats || throttleSeats.value;
    throttleSeatCount.value = biddingRules?.throttleSeatCount || throttleSeatCount.value;
    throttleSpending.value = biddingRules?.throttleSpending || throttleSpending.value;
    throttleSpendingAmount.value = biddingRules?.throttleSpendingAmount || throttleSpendingAmount.value;
    throttleDistributeEvenly.value = biddingRules?.throttleDistributeEvenly || throttleDistributeEvenly.value;

    disableBotType.value = biddingRules?.disableBotType || disableBotType.value;

    updateAPYs();
    isLoaded.value = true;

    // updateStartingAmountFormulaPrice();
    // updateFinalAmountFormulaPrice();
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
