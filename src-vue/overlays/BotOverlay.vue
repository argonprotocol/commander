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
              <DialogTitle as="div" class="relative z-10">{{ isBrandNew ? 'Configure' : 'Update' }} Your Mining Bot</DialogTitle>
              <div @click="cancelOverlay" class="absolute top-[22px] right-[0px] z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/70 hover:bg-[#D6D9DF]">
                <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
              </div>
            </h2>

            <div v-if="isLoaded && !wantsToImportExisting" class="flex flex-col grow relative w-full">
              <DialogDescription class="opacity-80 font-light py-6 pl-10 pr-[6%]">
                Commander uses an automated bidding bot to maximize your chance of winning seats. This screen allows you to
                configure the rules for how your bot should make decisions and place bids.
                <template v-if="!config.isMinerReadyToInstall && !config.isMinerInstalled">
                  You can also  <span @click="wantsToImportExisting = true" class="text-argon-600 hover:text-argon-600/80 cursor-pointer">import from an existing cloud machine</span>.
                </template>
              </DialogDescription>

              <section class="flex flex-row border-t border-b border-slate-500/30 text-center pt-8 pb-8 px-3.5 mx-5 justify-stretch">
                <div class="w-1/2 flex flex-col grow">
                  <BotCapital align="start" :width="botCapitalWidth">
                    <div PrimaryStat @mouseenter="botCapitalWidth = calculateElementWidth($event?.target as HTMLElement)" class="flex flex-col grow group border border-slate-500/30 rounded-lg shadow-sm">
                      <header StatHeader class="mx-0.5 pt-5 pb-0 relative">
                        Capital {{ isBrandNew ? 'to Commit' : 'Committed' }}
                      </header>
                      <div class="grow flex flex-col mt-3 border-t border-slate-500/30 border-dashed w-10/12 mx-auto">
                        <div class="text-gray-500/60 border-b border-slate-500/30 border-dashed py-3 w-full">
                          You are committing 16 argonot tokens, plus
                        </div>
                        <div class="flex flex-row items-center justify-center grow relative h-26 text-5xl font-bold font-mono text-argon-600">
                          <NeedMoreCapitalHover v-if="probableMinSeats < rules.seatGoalCount" :calculator="calculator" />
                          <InputArgon v-model="rules.baseCapitalCommitment" :min="10_000_000n" :minDecimals="0" />
                        </div>
                        <div class="text-gray-500/60 border-t border-slate-500/30 border-dashed py-5 w-10/12 mx-auto">
                          This capital will give you a good chance of<br/>
                          capturing
                          <template v-if="probableMinSeats === probableMaxSeats">({{ probableMinSeats }} mining seats per epoch.</template>
                          <template v-else>between {{ probableMinSeats }} and {{ probableMaxSeats }} mining seats per epoch.</template>
                        </div>
                      </div>
                    </div>
                  </BotCapital>
                </div>
                <div class="flex flex-col items-center justify-center text-3xl mx-2 text-center">
                  <span class="relative -top-1 opacity-50">
                    =
                  </span>
                </div>
                <div class="w-1/2 flex flex-col grow">
                  <BotReturns align="end" :width="botReturnsWidth">
                    <div PrimaryStat @mouseenter="botReturnsWidth = calculateElementWidth($event?.target as HTMLElement)" class="flex flex-col grow group border border-slate-500/30 rounded-lg shadow-sm">
                      <header StatHeader class="mx-0.5 pt-5 pb-0 relative">
                        Return on Capital
                      </header>
                      <div class="grow flex flex-col mt-3 border-t border-slate-500/30 border-dashed w-10/12 mx-auto">
                        <div class="text-gray-500/60 border-b border-slate-500/30 border-dashed py-3 w-full">
                          You are expected to earn {{ currency.symbol }}{{ microgonToMoneyNm(averageEarnings).format('0,0.00') }} per epoch with an APY of
                        </div>
                        <div class="flex flex-row items-center justify-center grow relative h-26 text-5xl font-bold font-mono text-argon-600">
                          {{ numeral(averageAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 999_999) }}%
                        </div>
                        <div class="text-gray-500/60 border-t border-slate-500/30 border-dashed py-5 w-full">
                        This represents the average of your estimated return<br/>
                        range, which is between
                        {{ numeral(maximumBidAtSlowGrowthAPY).formatIfElseCapped('>=100', '0,0', '0,0.[00]', 999_999) }}%
                        and {{ numeral(minimumBidAtFastGrowthAPY).formatIfElseCapped('>=100', '0,0', '0,0.[00]', 999_999) }}% APY.
                      </div>
                      </div>
                    </div>
                  </BotReturns>
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
                        {{ config.isMinerInstalled ? 'Existing Server' : 'New Server' }}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
            <div v-else-if="isLoaded && wantsToImportExisting" class="flex flex-col items-center justify-center grow relative w-full">
              <div class="flex flex-col relative w-120">
                <div class="flex flex-row items-center text-gray-500/60 hover:text-argon-600/70 cursor-pointer" @click="cancelImport()">
                  <ArrowLongLeftIcon class="w-5 h-5 inline-block relative mb-5" />
                  <span class="ml-1 mb-5">Go Back</span>
                </div>
                <div class="text-2xl font-bold text-gray-500 mb-1">Import From Existing Cloud Machine</div>
                <div class="text-md text-gray-600/80">
                  <div class="mb-4">
                    This will overwrite your current settings with configuration data from the server located at the IP address you
                    enter below. This server will also be used to run your bot, and it must be accessible through the same
                    SSH creditionals connected to this app.
                  </div>
                  <div class="pr-5">
                    <div v-if="importError" class="flex flex-row bg-red-50/80 border border-red-600/10 border-b-0 text-red-600 text-md px-3 py-2 rounded-md">
                      <ArrowTurnLeftDownIcon class="w-5 h-5 inline-block mr-1 relative top-1.5" />
                      <span>{{ importError }}</span>
                    </div>
                    <input v-model="importIpAddress" type="text" class="w-full border border-gray-300 rounded-md px-3 py-2 mb-4" placeholder="0.0.0.0" @keyup.enter="startImport" />
                  </div>
                  <button @click="startImport" class="bg-argon-button hover:border-argon-800 text-xl font-bold text-white px-7 py-1 rounded-md cursor-pointer">
                    {{ isImporting ? 'Importing Config...' : 'Import Config' }}
                  </button>
                </div>
              </div>
            </div>
            <div v-else>Loading...</div>

            <div class="flex flex-row justify-end border-t border-slate-300 mx-4 py-4 space-x-4 rounded-b-lg">
              <div :class="[wantsToImportExisting ? 'opacity-50 pointer-events-none' : '']" class="flex flex-row space-x-4 justify-center items-center">
                <ActiveBidsOverlayButton :loadFromMainchain="true" class="mr-10">
                  <span class="text-argon-600/70 cursor-pointer">Show Existing Mining Bids</span>
                </ActiveBidsOverlayButton>
                <button @click="cancelOverlay" class="border border-argon-button/50 hover:border-argon-button text-xl font-bold text-gray-500 px-7 py-1 rounded-md cursor-pointer">
                  <span>Cancel</span>
                </button>
                <button @click="saveRules" @mouseenter="showTooltip($event, tooltip.saveRules, { width: 'parent' })" @mouseleave="hideTooltip" class="bg-argon-button hover:border-argon-800 text-xl font-bold text-white px-7 py-1 rounded-md cursor-pointer">
                  <span v-if="!isSaving">{{ isBrandNew ? 'Initialize Rules' : 'Update Rules' }}</span>
                  <span v-else>{{ isBrandNew ? 'Initializing...' : 'Updating...' }}</span>
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
import Tooltip from '../components/Tooltip.vue';
import basicEmitter from '../emitters/basicEmitter';
import { useConfig, Config } from '../stores/config';
import { useCurrency } from '../stores/currency';
import { getCalculator, getCalculatorData } from '../stores/mainchain';
import { getDbPromise } from '../stores/helpers/dbPromise';
import numeral, { createNumeralHelpers } from '../lib/numeral';
import BgOverlay from '../components/BgOverlay.vue';
import { ArrowLongLeftIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { ArrowTurnLeftDownIcon } from '@heroicons/vue/24/solid';
import AlertIcon from '../assets/alert.svg?component';
import { showTooltip as showTooltipOriginal, hideTooltip } from '../lib/TooltipUtils';
import EditBoxOverlay, { type IEditBoxOverlayTypeForMining } from './EditBoxOverlay.vue';
import { type IBiddingRules } from '@argonprotocol/commander-core';
import ActiveBidsOverlayButton from './ActiveBidsOverlayButton.vue';
import {
  BidAmountAdjustmentType,
  BidAmountFormulaType,
  SeatGoalInterval,
  SeatGoalType,
} from '@argonprotocol/commander-core/src/IBiddingRules.ts';
import { bigIntAbs } from '@argonprotocol/commander-core/src/utils';
import { JsonExt } from '@argonprotocol/commander-core';
import InputArgon from '../components/InputArgon.vue';
import NeedMoreCapitalHover from './bot/NeedMoreCapitalHover.vue';
import Importer from '../lib/Importer';
import BotReturns from './bot/BotReturns.vue';
import BotCapital from './bot/BotCapital.vue';
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

const { microgonToMoneyNm } = createNumeralHelpers(currency);

const rules = Vue.computed(() => {
  return config.biddingRules as IBiddingRules;
});

const isBrandNew = Vue.ref(true);
const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);
const isSaving = Vue.ref(false);
const wantsToImportExisting = Vue.ref(false);

const botCapitalWidth = Vue.ref('');
const botReturnsWidth = Vue.ref('');

const importIpAddress = Vue.ref('');
const importError = Vue.ref<string | null>(null);
const isImporting = Vue.ref(false);

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

const averageAPY = Vue.ref(0);
const averageEarnings = Vue.ref(0n);

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
    return `This is your bot's goal, not its ceiling. ${interval}. If the bot can snag more than ${rules.value.seatGoalCount} seats, it will do so. If it fails to achieve its goal, it will alert you in the app.`;
  }),
  expectedGrowth: `These numbers don't affect your bot's decisions; they only factor into the Estimated APY shown above. Argons is growth in circulation; Argonots is change in token price. Both are factored annually.`,
  cloudMachine: `You can leave this server configuration box as-is for now. Later in the process, we'll guide you through the step-by-step flow of how to set up a new Cloud Machine. Don't worry, it's easy.`,
  saveRules: `Let's go! You can modify the rules later.`,
};

function calculateElementWidth(element: HTMLElement) {
  return element.getBoundingClientRect().width + 'px';
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

async function startImport() {
  isImporting.value = true;
  importError.value = null;

  if (!importIpAddress.value) {
    isImporting.value = true;
    importError.value = 'You must enter an IP address';
    return;
  }

  try {
    const importer = new Importer(config as Config, dbPromise);
    await importer.importFromServer(importIpAddress.value);
  } catch (error) {
    isImporting.value = false;
    importError.value = error instanceof Error ? error.message : 'An unknown error occurred';
  }

  isBrandNew.value = false;
  wantsToImportExisting.value = false;
  isImporting.value = false;
}

function cancelImport() {
  isImporting.value = false;
  wantsToImportExisting.value = false;
}

async function saveRules() {
  isSaving.value = true;

  let didSave = false;
  if (rules.value) {
    rules.value.requiredMicronots = calculateMicronotsRequired();
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

  minimumBidAmount.value = calculator.minimumBidAmount;
  minimumBidAmountOverride.value = calculator.minimumBidAmountOverride;

  maximumBidAmount.value = calculator.maximumBidAmount;
  maximumBidAmountOverride.value = calculator.maximumBidAmountOverride;

  minimumBidAtSlowGrowthAPY.value = calculator.minimumBidAtSlowGrowthAPY;
  minimumBidAtFastGrowthAPY.value = calculator.minimumBidAtFastGrowthAPY;
  maximumBidAtSlowGrowthAPY.value = calculator.maximumBidAtSlowGrowthAPY;
  maximumBidAtFastGrowthAPY.value = calculator.maximumBidAtFastGrowthAPY;

  averageAPY.value = calculator.averageAPY;

  const probableMinSeatsBn = BigNumber(rules.value.baseCapitalCommitment).dividedBy(calculator.maximumBidAmount);
  probableMinSeats.value = Math.max(probableMinSeatsBn.integerValue(BigNumber.ROUND_FLOOR).toNumber(), 0);

  const probableMaxSeatsBn = BigNumber(rules.value.baseCapitalCommitment).dividedBy(calculator.minimumBidAmount);
  probableMaxSeats.value = Math.min(
    probableMaxSeatsBn.integerValue(BigNumber.ROUND_FLOOR).toNumber(),
    calculatorData.miningSeatCount,
  );

  const slowGrowthEarnings = BigInt(probableMinSeats.value) * calculator.slowGrowthRewards;
  const fastGrowthEarnings = BigInt(probableMaxSeats.value) * calculator.fastGrowthRewards;
  averageEarnings.value = (slowGrowthEarnings + fastGrowthEarnings) / 2n;
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
  wantsToImportExisting.value = false;

  isBrandNew.value = !config.hasSavedBiddingRules;
  calculatorData.isInitializedPromise.then(() => {
    previousBiddingRules = JsonExt.stringify(config.biddingRules);
    if (isBrandNew.value) {
      const minimumCapitalNeeded = calculator.maximumBidAmount * BigInt(rules.value.seatGoalCount);
      const minimumCapitalNeededRoundedUp = Math.ceil(Number(minimumCapitalNeeded) / 1_000_000) * 1_000_000;
      rules.value.baseCapitalCommitment = BigInt(minimumCapitalNeededRoundedUp);
    }
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

    /* &::before {
      @apply from-argon-menu-bg bg-gradient-to-b from-[0px] to-transparent;
      content: '';
      display: block;
      width: calc(100% + 10px);
      height: 30%;
      position: absolute;
      top: -5px;
      left: -5px;
    } */
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
