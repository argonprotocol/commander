<!-- prettier-ignore -->
<template>
  <DialogRoot class="absolute inset-0 z-10" :open="isOpen">
    <DialogPortal>
      <DialogOverlay asChild>
        <BgOverlay @close="cancelOverlay" />
      </DialogOverlay>

      <DialogContent @escapeKeyDown="cancelOverlay" :aria-describedby="undefined">
        <EditBoxOverlay
          v-if="editBoxOverlayId"
          :id="editBoxOverlayId"
          :position="editBoxOverlayPosition"
          :previousId="editBoxOverlayPreviousId"
          :nextId="editBoxOverlayNextId"
          @close="editBoxOverlayId = null"
          @goTo="(id: any) => openEditBoxOverlay(id)"
          @update:data="updateAPYs"
        />
        <BotTour v-if="currentTourStep" @close="closeTour" @changeStep="currentTourStep = $event" :getPositionCheck="getTourPositionCheck" />
        <div
          :ref="draggable.setModalRef"
          :style="{
            // top: `calc(50% + ${draggable.modalPosition.y}px)`,
            // left: `calc(50% + ${draggable.modalPosition.x}px)`,
            // transform: 'translate(-50%, -50%)',
            // cursor: draggable.isDragging ? 'grabbing' : 'default',
          }"
          class="BotOverlay absolute top-[40px] left-3 right-3 bottom-3 flex flex-col rounded-md border border-black/30 inner-input-shadow bg-argon-menu-bg text-left z-20 transition-all focus:outline-none"
          style="box-shadow: 0px -1px 2px 0 rgba(0, 0, 0, 0.1), inset 0 2px 0 rgba(255, 255, 255, 1)"
        >
          <BgOverlay v-if="editBoxOverlayId" @close="editBoxOverlayId = null" :showWindowControls="false" rounded="md" class="z-100" />
          <div v-if="isSuggestingTour" class="absolute inset-0 bg-black/20 z-20 rounded-md"></div>
          <div class="flex flex-col h-full w-full">
            <h2
              @mousedown="draggable.onMouseDown($event)" 
              class="relative text-3xl font-bold text-left border-b border-slate-300 pt-5 pb-4 pl-3 mx-4 text-[#672D73]"
              style="box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1)"
            >
              <DialogTitle as="div" class="relative z-10">Configure Your Mining Bot</DialogTitle>
              <div @click="cancelOverlay" class="absolute top-[22px] right-[0px] z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/70 hover:bg-[#D6D9DF]">
                <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
              </div>
            </h2>

            <div v-if="isLoaded" class="flex flex-col grow relative w-full">
              <DialogDescription class="text-gray-600 font-light py-6 pl-10 pr-[6%]">
                Commander uses an automated bidding bot to maximize your chance of winning seats, and this screen allows you to
                configure the rules for how this bot should make decisions on your behalf. Use your mouse to explore the various
                settings and their impact on your potential profits.
                <PopoverRoot :open="isSuggestingTour">
                  <PopoverTrigger asChild>
                    <div :class="[isSuggestingTour ? '' : 'hover:underline']" class="inline-block relative cursor-pointer text-argon-600/80 hover:text-argon-800 decoration-dashed underline-offset-4 z-30" @click="startTour">
                      <span class="relative z-10 font-semibold">Take the quick Mining Tour</span>
                      <div v-if="isSuggestingTour" class="border rounded-full border-argon-600/30 bg-white/50 absolute -top-0 -left-2 -right-2 -bottom-0"></div>
                    </div>
                  </PopoverTrigger>
                  <PopoverPortal>
                    <PopoverContent side="bottom" class="rounded-lg p-5 -translate-y-1 w-[400px] bg-white shadow-sm border border-slate-800/30 z-1000">
                      <p class="text-gray-800 font-light">We recommend first-time miners start with a brief tour of how to use this overlay.</p>
                      <div class="flex flex-row space-x-2 mt-6">
                        <button @click="stopSuggestingTour" tabindex="-1" class="cursor-pointer grow rounded-md border border-slate-500/30 px-4 py-1 focus:outline-none">Not Now</button>
                        <button @click="startTour" tabindex="0" class="cursor-pointer grow rounded-md bg-argon-button border border-argon-button-hover hover:bg-argon-button-hover text-white font-bold inner-button-shadow px-4 py-1 focus:outline-none">Start Tour</button>
                      </div>
                      <PopoverArrow :width="24" :height="12" class="fill-white stroke-gray-400/50 shadow-2xl -mt-px" />
                    </PopoverContent>
                  </PopoverPortal>
                </PopoverRoot>.
              </DialogDescription>

              <section class="flex flex-row border-t border-b border-slate-500/30 text-center pt-8 pb-8 px-3.5 mx-5 justify-stretch">
                <div class="w-1/2 flex flex-col grow">
                  <div PrimaryStat :isTouring="currentTourStep === 1" ref="capitalToCommitElement" class="flex flex-col grow group border border-slate-500/30 rounded-lg shadow-sm">
                    <header StatHeader class="mx-0.5 pt-5 pb-0 relative">
                      <tooltip side="top" content="The amount you're willing to invest in mining seats">
                        Capital {{ isBrandNew ? 'to Commit' : 'Committed' }}
                      </tooltip>
                    </header>
                    <div class="grow flex flex-col mt-3 border-t border-slate-500/30 border-dashed w-10/12 mx-auto">
                      <div class="text-gray-500/60 border-b border-slate-500/30 border-dashed py-3 w-full">
                        To secure <tooltip content="Customize this in the Capital Allocation box below">your goal</tooltip> of
                        {{getEpochSeatGoalCount()}} mining seats <tooltip content="An epoch is equivalent to ten days">per epoch</tooltip>, you need
                      </div>
                      <div class="flex flex-row items-center justify-center grow relative h-26 font-bold font-mono text-argon-600">
                        <NeedMoreCapitalHover v-if="minimumCapitalCommitment > capitalToCommitMicrogons" :calculator="calculator" :seat-goal-count="getEpochSeatGoalCount()" :ideal-capital-commitment="minimumCapitalCommitment" @increase-capital-commitment="updateMinimumCapital()" />
                        <InputArgon v-model="capitalToCommitMicrogons" :min="0n" :minDecimals="0" />
                        <CapitalOverlay align="end">
                          <PiechartIcon PiechartIcon class="ml-1 w-10 h-10 text-gray-300 hover:!text-argon-600" />
                        </CapitalOverlay>
                      </div>
                      <div class="text-gray-500/60 border-t border-slate-500/30 border-dashed py-5 w-full mx-auto">
                        This is the <tooltip content="Click the capital amount listed above to directly change your commitment">amount of capital you'll need</tooltip> for acquiring<br/>
                        {{ micronotToArgonotNm(rules.baseMicronotCommitment).format('0,0') }}
                        <tooltip content="Argonots are the ownership tokens of the network">argonot{{ micronotToArgonotNm(rules.baseMicronotCommitment).format('0,0') === '1' ? '' : 's' }}</tooltip>
                        and {{ microgonToArgonNm(rules.baseMicrogonCommitment).format('0,0') }}
                        <tooltip content="Argons are the stable currency of the network">argon{{ microgonToArgonNm(rules.baseMicrogonCommitment).format('0,0') === '0,0' ? '' : 's' }}</tooltip>
                        at their <tooltip content="Prices reflect as closely as possible the real-time rates on Uniswap's trading exchange">current market rates</tooltip>.
                      </div>
                    </div>
                  </div>
                </div>
                <div class="flex flex-col items-center justify-center text-3xl mx-2 text-center">
                  <span class="relative -top-1 opacity-50">
                    =
                  </span>
                </div>
                <div class="w-1/2 flex flex-col grow">
                  <div PrimaryStat :isTouring="currentTourStep === 2" ref="returnOnCapitalElement" class="flex flex-col grow group border border-slate-500/30 rounded-lg shadow-sm">
                    <header StatHeader class="mx-0.5 pt-5 pb-0 relative">
                      <tooltip side="top" content="The amount you might earn on your capital">
                        Return on Capital
                      </tooltip>
                    </header>
                    <div class="grow flex flex-col mt-3 border-t border-slate-500/30 border-dashed w-10/12 mx-auto">
                      <div class="text-gray-500/60 border-b border-slate-500/30 border-dashed py-3 w-full">
                        Your capital is <tooltip content="This is not a guarantee, simply an estimate">estimated</tooltip> to return
                        {{ numeral(epochPercentageYield).formatCapped('0,0.00', 999_999) }}% <tooltip content="An epoch is equivalent to ten days">per epoch</tooltip>
                        at an <tooltip content="Annual Percent Yield">APY</tooltip> of
                      </div>
                      <div class="flex flex-row items-center justify-center grow relative h-26 text-6xl font-bold font-mono text-argon-600">
                        <span>~{{ numeral(averageAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 999_999) }}%</span>
                        <ReturnsOverlay align="start">
                          <PiechartIcon PiechartIcon class="ml-4 w-10 h-10 text-gray-300 hover:!text-argon-600" />
                        </ReturnsOverlay>
                      </div>
                      <div class="text-gray-500/60 border-t border-slate-500/30 border-dashed py-5 w-full">
                      This represents the <tooltip content="It's a blend between multiple possibilities">average return</tooltip> between
                      your <tooltip content="Your bot's opening bid each day">starting</tooltip> <br />
                      <tooltip content="Your bot's opening bid each day">bid</tooltip> and
                      <tooltip content="The price your bot won't go above">maximum bid</tooltip>,
                      between <tooltip content="Customize this in the Ecosystem Growth box below">slow growth</tooltip> and
                      <tooltip content="Customize this in the Ecosystem Growth box below">fast growth</tooltip>.
                    </div>
                    </div>
                  </div>
                </div>
              </section>

              <div ref="configBoxesElement" class="flex flex-col relative grow px-5 text-lg">
                <section class="flex flex-row h-1/2 my-2">

                  <div MainWrapperParent ref="startingBidParent" class="w-1/3">
                    <tooltip asChild :calculateWidth="() => calculateElementWidth(startingBidParent)" side="top" content="This is your starting bid price. Don't put it too low or you'll be forced to pay unneeded transaction fees in order to submit a rebid.">
                      <div MainWrapper @click="openEditBoxOverlay('startingBid')" class="flex flex-col w-full h-full items-center justify-center px-8">
                        <div StatHeader>Starting Bid</div>
                        <div v-if="startingBidAmountOverride" MainRule class="flex flex-row items-center justify-center w-full">
                          <div class="flex flex-row items-center justify-center space-x-2">
                            <AlertIcon class="w-5 h-5 text-yellow-700 inline-block relative -top-0.5" />
                            <span class="line-through text-gray-500/60">{{ currency.symbol }}{{ microgonToMoneyNm(startingBidAmount).format('0,0.00') }}</span>
                            <span>{{ currency.symbol }}{{ microgonToMoneyNm(startingBidAmountOverride).format('0,0.00') }}</span>
                          </div>
                          <EditIcon EditIcon />
                        </div>
                        <div v-else MainRule class="flex flex-row items-center justify-center w-full">
                          <span>{{ currency.symbol }}{{ microgonToMoneyNm(startingBidAmount).format('0,0.00') }}</span>
                          <EditIcon EditIcon />
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
                    </tooltip>
                  </div>

                  <div class="w-[1px] bg-slate-300/80 mx-2"></div>

                  <div MainWrapperParent ref="maximumBidParent" class="w-1/3">
                    <tooltip asChild :calculateWidth="() => calculateElementWidth(maximumBidParent)" side="top" content="Your mining bot will never submit a bid above this price. If other bidders go higher than this, you will be knocked out of contention.">
                      <div MainWrapper @click="openEditBoxOverlay('maximumBid')" class="flex flex-col w-full h-full items-center justify-center px-8">
                        <div StatHeader>Maximum Bid</div>
                        <div v-if="maximumBidAmountOverride" MainRule class="w-full flex flex-row items-center justify-center">
                          <div class="flex flex-row items-center justify-center space-x-2">
                            <AlertIcon class="w-5 h-5 text-yellow-700 inline-block relative -top-0.5" />
                            <span class="line-through text-gray-500/60">{{ currency.symbol }}{{ microgonToMoneyNm(maximumBidAmount).format('0,0.00') }}</span>
                            <span>{{ currency.symbol }}{{ microgonToMoneyNm(maximumBidAmountOverride).format('0,0.00') }}</span>
                          </div>
                          <EditIcon EditIcon />
                        </div>
                        <div v-else MainRule class="flex flex-row items-center justify-center w-full">
                          <span>{{ currency.symbol }}{{ microgonToMoneyNm(maximumBidAmount).format('0,0.00') }}</span>
                          <EditIcon EditIcon />
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
                    </tooltip>
                  </div>

                  <div class="w-[1px] bg-slate-300/80 mx-2"></div>

                  <div MainWrapperParent ref="rebiddingStrategyParent" class="flex flex-col items-center justify-center relative w-1/3">
                    <tooltip asChild :calculateWidth="() => calculateElementWidth(rebiddingStrategyParent)" side="top" :content="`If your bids get knocked out of contention, your bot will wait ${rules.rebiddingDelay} minute${rules.rebiddingDelay === 1 ? '' : 's'} before submitting a new bid at ${currency.symbol}${microgonToMoneyNm(rules.rebiddingIncrementBy).format('0.00')} above the current winning bid.`">
                      <div MainWrapper @click="openEditBoxOverlay('rebiddingStrategy')" class="flex flex-col w-full h-full items-center justify-center px-8">
                        <div StatHeader>Rebidding Strategy</div>
                        <div MainRule class="flex flex-row items-center justify-center w-full">
                          <span>+{{ currency.symbol }}{{ microgonToMoneyNm(rules.rebiddingIncrementBy).format('0.00') }}</span>
                          <EditIcon EditIcon />
                        </div>
                        <div class="text-gray-500/60 text-md">
                          Delay By {{ rules.rebiddingDelay }} Minute{{ rules.rebiddingDelay === 1 ? '' : 's' }}
                        </div>
                      </div>
                    </tooltip>
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
                  <div MainWrapperParent ref="capitalAllocationParent" class="flex flex-col items-center justify-center relative w-1/3">
                    <tooltip asChild :calculateWidth="() => calculateElementWidth(capitalAllocationParent)" side="top" :content="`This is your bot's goal, not its ceiling. If the bot can snag more than ${seatGoalText()}, it will do so. If it fails to achieve its goal, it will alert you in the app.`">
                      <div MainWrapper @click="openEditBoxOverlay('capitalAllocation')" class="flex flex-col w-full h-full items-center justify-center px-8">
                        <div StatHeader>Capital Allocation</div>
                        <div MainRule v-if="rules.seatGoalType === SeatGoalType.Max && rules.seatGoalCount === 0" class="w-full">
                          Disabled
                        </div>
                        <div MainRule v-else class="flex flex-row items-center justify-center w-full">
                          <span>{{ rules.seatGoalType }} {{ rules.seatGoalCount }} Seats Per {{ rules.seatGoalInterval }}</span>
                          <EditIcon EditIcon />
                        </div>
                        <div class="text-gray-500/60 text-md">
                          {{ rules.seatGoalType === SeatGoalType.Max ? 'Stop After Goal Reached' : 'Reinvest Profits from Operation' }}
                        </div>
                      </div>
                    </tooltip>
                  </div>

                  <div class="w-[1px] bg-slate-300/80 mx-2"></div>

                  <div MainWrapperParent ref="expectedGrowthParent" class="flex flex-col items-center justify-center relative w-1/3">
                    <tooltip asChild :calculateWidth="() => calculateElementWidth(expectedGrowthParent)" side="top" content="These numbers don't affect your bot's decisions; they only factor into the Estimated APY shown above. Argons is growth in circulation; Argonots is change in token price. Both are factored annually.">
                      <div MainWrapper @click="openEditBoxOverlay('expectedGrowth')" class="flex flex-col w-full h-full items-center justify-center">
                        <div StatHeader>Ecosystem Growth</div>
                        <div class="flex flex-row items-center justify-center px-8 w-full text-center font-mono">
                          <div MainRule class="flex flex-row items-center justify-center w-5/12">
                            <span>{{ numeral(rules.argonCirculationGrowthPctMin).formatIfElse('0', '0', '+0.[0]') }}%</span>
                            <span class="text-md px-1.5 text-gray-500/60">to</span>
                            <span>{{ numeral(rules.argonCirculationGrowthPctMax).formatIfElse('0', '0', '+0.[0]')}}%</span>
                            <EditIcon EditIcon />
                          </div>
                          <span class="text-md w-2/12 text-gray-500/60">&nbsp;and&nbsp;</span>
                          <div MainRule class="flex flex-row items-center justify-center w-5/12">
                            <span>{{ numeral(rules.argonotPriceChangePctMin).formatIfElse('0', '0', '+0.[0]') }}%</span>
                            <span class="text-md px-1.5 text-gray-500/60">to</span>
                            <span>{{ numeral(rules.argonotPriceChangePctMax).formatIfElse('0', '0', '+0.[0]')}}%</span>
                            <EditIcon EditIcon />
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
                    </tooltip>
                  </div>

                  <div class="w-[1px] bg-slate-300/80 mx-2"></div>

                  <div MainWrapperParent ref="cloudMachineParent" class="flex flex-col items-center justify-center relative w-1/3">
                    <tooltip asChild :calculateWidth="() => calculateElementWidth(cloudMachineParent)" side="top" content="You can leave this server configuration box as-is for now. Later in the process, we'll guide you through the step-by-step flow of how to set up a new Mining Machine. Don't worry, it's easy.">
                      <div MainWrapper @click="openEditBoxOverlay('cloudMachine')" class="flex flex-col w-full h-full items-center justify-center px-8">
                        <div StatHeader>Mining Machine</div>
                        <div MainRule class="tracking-widest w-full flex flex-row items-center justify-center">
                          <span>{{ config.serverDetails.ipAddress || '0.0.0.0' }}</span>
                          <EditIcon EditIcon />
                        </div>
                        <div class="text-gray-500/60 text-md font-mono">
                          {{ config.isMinerInstalled ? 'Existing Server' : 'New Server' }}
                        </div>
                      </div>
                    </tooltip>
                  </div>
                </section>
              </div>
            </div>
            <div v-else class="grow flex items-center justify-center">Loading...</div>

            <div class="flex flex-row justify-end border-t border-slate-300 mx-4 py-4 space-x-4 rounded-b-lg">
              <div class="flex flex-row space-x-4 justify-center items-center">
                <ActiveBidsOverlayButton :loadFromMainchain="true" class="mr-10">
                  <span class="text-argon-600/70 cursor-pointer">Show Existing Mining Bids</span>
                </ActiveBidsOverlayButton>
                <button @click="cancelOverlay" tabindex="-1" class="border border-argon-button/50 hover:border-argon-button text-xl font-bold text-gray-500 px-7 py-1 rounded-md cursor-pointer">
                  <span>Cancel</span>
                </button>
                <tooltip asChild :calculateWidth="() => calculateElementWidth(saveButtonElement)" side="top" content="Clicking this button does not commit you to anything.">
                  <button @click="saveRules" tabindex="0" ref="saveButtonElement" class="bg-argon-button hover:border-argon-800 text-xl font-bold text-white px-7 py-1 rounded-md cursor-pointer">
                    <span v-if="!isSaving">{{ isBrandNew ? 'Initialize' : 'Update' }} Rules</span>
                    <span v-else>{{ isBrandNew ? 'Initializing' : 'Updating' }} Rules...</span>
                  </button>
                </tooltip>
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
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  PopoverArrow,
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger,
} from 'reka-ui';
import basicEmitter from '../emitters/basicEmitter';
import { useConfig } from '../stores/config';
import { useCurrency } from '../stores/currency';
import { getBiddingCalculator, getBiddingCalculatorData } from '../stores/mainchain';
import numeral, { createNumeralHelpers } from '../lib/numeral';
import BgOverlay from '../components/BgOverlay.vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import AlertIcon from '../assets/alert.svg?component';
import EditBoxOverlay, { type IEditBoxOverlayTypeForMining } from './EditBoxOverlay.vue';
import {
  BidAmountAdjustmentType,
  BidAmountFormulaType,
  type IBiddingRules,
  JsonExt,
  SeatGoalInterval,
  SeatGoalType,
} from '@argonprotocol/commander-core';
import ActiveBidsOverlayButton from './ActiveBidsOverlayButton.vue';
import { bigIntAbs, bigIntCeil, bigNumberToInteger, ceilTo } from '@argonprotocol/commander-core/src/utils';
import InputArgon from '../components/InputArgon.vue';
import NeedMoreCapitalHover from './bot/NeedMoreCapitalHover.vue';
import ReturnsOverlay from './bot/BotReturns.vue';
import CapitalOverlay from './bot/BotCapital.vue';
import { useBot } from '../stores/bot.ts';
import PiechartIcon from '../assets/piechart.svg?component';
import EditIcon from '../assets/edit.svg?component';
import Tooltip from '../components/Tooltip.vue';
import { ITourPos } from '../stores/tour.ts';
import BotTour from './BotTour.vue';
import { useController } from '../stores/controller';
import Draggable from './helpers/Draggable.ts';

const calculator = getBiddingCalculator();
const calculatorData = getBiddingCalculatorData();

let previousBiddingRules: string | null = null;

const currency = useCurrency();
const config = useConfig();
const bot = useBot();
const controller = useController();

const draggable = Vue.reactive(new Draggable());
const { microgonToMoneyNm, microgonToArgonNm, micronotToArgonotNm } = createNumeralHelpers(currency);

const rules = Vue.computed(() => {
  return config.biddingRules as IBiddingRules;
});

const isBrandNew = Vue.ref(true);
const isSuggestingTour = Vue.ref(false);
const currentTourStep = Vue.ref<number>(0);
const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);
const isSaving = Vue.ref(false);

const capitalToCommitElement = Vue.ref<HTMLElement | null>(null);
const returnOnCapitalElement = Vue.ref<HTMLElement | null>(null);
const configBoxesElement = Vue.ref<HTMLElement | null>(null);
const saveButtonElement = Vue.ref<HTMLElement | null>(null);

const startingBidParent = Vue.ref<HTMLElement | null>(null);
const maximumBidParent = Vue.ref<HTMLElement | null>(null);
const rebiddingStrategyParent = Vue.ref<HTMLElement | null>(null);
const capitalAllocationParent = Vue.ref<HTMLElement | null>(null);
const expectedGrowthParent = Vue.ref<HTMLElement | null>(null);
const cloudMachineParent = Vue.ref<HTMLElement | null>(null);

const editBoxParents: Record<IEditBoxOverlayTypeForMining, Vue.Ref<HTMLElement | null>> = {
  startingBid: startingBidParent,
  maximumBid: maximumBidParent,
  rebiddingStrategy: rebiddingStrategyParent,
  capitalAllocation: capitalAllocationParent,
  expectedGrowth: expectedGrowthParent,
  cloudMachine: cloudMachineParent,
};

const editBoxOverlayId = Vue.ref<IEditBoxOverlayTypeForMining | null>(null);
const editBoxOverlayPosition = Vue.ref<{ top?: number; left?: number; width?: number } | undefined>(undefined);
const editBoxOverlayPreviousId = Vue.ref<IEditBoxOverlayTypeForMining | undefined>();
const editBoxOverlayNextId = Vue.ref<IEditBoxOverlayTypeForMining | undefined>();

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

function getTourPositionCheck(name: string): ITourPos {
  if (name === 'capitalToCommit') {
    const rect = capitalToCommitElement.value?.getBoundingClientRect() as DOMRect;
    return {
      left: rect.left,
      top: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      width: rect.width,
      height: rect.height,
    };
  } else if (name === 'returnOnCapital') {
    const rect = returnOnCapitalElement.value?.getBoundingClientRect() as DOMRect;
    return {
      left: rect.left,
      top: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      width: rect.width,
      height: rect.height,
    };
  } else if (name === 'configBoxes') {
    const rect = configBoxesElement.value?.getBoundingClientRect() as DOMRect;
    const left = rect.left + 20;
    const width = rect.width - 40;
    return {
      left: left,
      top: rect.top,
      right: left + width,
      bottom: rect.top + rect.height,
      width: width,
      height: rect.height,
    };
  } else if (name === 'saveButton') {
    const rect = saveButtonElement.value?.getBoundingClientRect() as DOMRect;
    const left = rect.left - 10;
    const width = rect.width + 20;
    const top = rect.top - 10;
    const height = rect.height + 20;
    return { left: left, top: top, right: left + width, bottom: top + height, width: width, height: height };
  } else {
    return { left: 100, top: 100, right: 200, bottom: 200, width: 100, height: 100 };
  }
}

function calculateElementWidth(element: HTMLElement | null) {
  if (!element) return;
  const elementWidth = element.getBoundingClientRect().width;
  return `${elementWidth}px`;
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

function openEditBoxOverlay(id: IEditBoxOverlayTypeForMining) {
  const parent = editBoxParents[id as keyof typeof editBoxParents].value as HTMLElement | null;
  const rect = parent?.getBoundingClientRect() as DOMRect;
  editBoxOverlayPosition.value = {
    top: rect.top,
    left: rect.left,
    width: rect.width,
  };
  const editBoxOverlayIds = Object.keys(editBoxParents) as IEditBoxOverlayTypeForMining[];
  const idIndex = editBoxOverlayIds.indexOf(id);
  editBoxOverlayId.value = id;
  editBoxOverlayPreviousId.value = editBoxOverlayIds[idIndex - 1] as IEditBoxOverlayTypeForMining | undefined;
  editBoxOverlayPreviousId.value ??= editBoxOverlayIds[editBoxOverlayIds.length - 1] as
    | IEditBoxOverlayTypeForMining
    | undefined;
  editBoxOverlayNextId.value = editBoxOverlayIds[idIndex + 1] as IEditBoxOverlayTypeForMining | undefined;
  editBoxOverlayNextId.value ??= editBoxOverlayIds[0] as IEditBoxOverlayTypeForMining | undefined;
}

function cancelOverlay() {
  if (editBoxOverlayId.value) return;
  isOpen.value = false;

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

const minimumCapitalCommitment = Vue.computed(() => {
  const epochSeatGoal = BigInt(getEpochSeatGoalCount());
  const minimumCapitalNeeded = calculator.maximumBidAmount * epochSeatGoal;
  const minimumCapitalNeededRoundedUp = ceilTo(minimumCapitalNeeded, 6);
  const micronotsNeeded = epochSeatGoal * calculatorData.micronotsRequiredForBid;
  const commitment = currency.micronotToMicrogon(micronotsNeeded) + BigInt(minimumCapitalNeededRoundedUp);
  return bigIntCeil(commitment, 1_000_000n);
});

function updateMinimumCapital() {
  capitalToCommitMicrogons.value = minimumCapitalCommitment.value;
}

function startTour() {
  currentTourStep.value = 1;
  isSuggestingTour.value = false;
}

function closeTour() {
  currentTourStep.value = 0;
}

function stopSuggestingTour() {
  controller.stopSuggestingBotTour = true;
  isSuggestingTour.value = false;
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
  isSuggestingTour.value = isBrandNew.value && !controller.stopSuggestingBotTour;
  calculatorData.isInitializedPromise.then(() => {
    previousBiddingRules = JsonExt.stringify(config.biddingRules);
    capitalToCommitMicrogons.value = minimumCapitalCommitment.value;
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

    [tooltip] {
      @apply transition-all duration-300;

      &:focus {
        @apply text-argon-600;
      }
    }

    &:hover,
    &[isTouring='true'] {
      [tooltip] {
        @apply text-argon-600 cursor-help;
      }
      [PiechartIcon] {
        animation: BotOverlay-fadeToArgon 2s ease-in-out 1;
      }
    }

    [InputFieldWrapper] {
      @apply text-argon-600 border-none font-mono text-6xl font-bold !outline-none hover:bg-transparent focus:!outline-none;
      box-shadow: none;
    }
    [NumArrows] {
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
      [EditIcon] {
        @apply w-4.5 min-w-4.5 opacity-100;
      }
    }

    [StatHeader] {
      @apply pt-1;
    }

    [EditIcon] {
      @apply text-argon-600/50 relative z-10 -mt-0.5 ml-2 h-4.5 min-h-4.5 w-0 min-w-0 opacity-0 transition-all duration-300;
    }

    [MainRule] {
      @apply text-argon-700/80 relative my-1.5 border-t border-b border-dashed border-slate-500/30 py-1 text-center font-mono font-bold;
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

@keyframes BotOverlay-fadeToArgon {
  0% {
    color: rgb(209 213 219); /* text-gray-300 */
    transform: scale(1);
  }
  30% {
    color: oklch(0.48 0.24 320); /* text-argon-600 */
    transform: scale(1.15);
  }
  100% {
    color: rgb(209 213 219); /* text-gray-300 */
    transform: scale(1);
  }
}
</style>
