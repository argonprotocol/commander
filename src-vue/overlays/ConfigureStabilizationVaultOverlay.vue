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
              {{ isBrandNew ? 'Create' : 'Update' }} Stabilization Vault
              <div
                @click="closeOverlay"
                class="absolute top-[22px] right-[0px] z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/70 hover:bg-[#D6D9DF]"
              >
                <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
              </div>
            </h2>

            <div class="flex flex-col grow relative w-full">
              <p class="opacity-80 font-light py-6 pl-10 pr-[6%]">
                Commander has a built-in bidding bot that helps maximize your chance of winning seats. This page allows
                you to configure the rules for how this bot should make decisions and place bids.
              </p>

              <section class="flex flex-row border-t border-b border-slate-300 text-center space-x-10 pt-10 pb-12 px-5 mx-5">
                <div class="w-1/2">
                  <header class="text-lg font-bold text-slate-500/70 pb-2">Capital to Commit</header>
                  <div
                    class="border border-slate-500/30 rounded-lg py-9 text-4xl font-bold font-mono text-argon-600 shadow-sm"
                  >
                    {{ currency.symbol }}{{ microgonToMoneyNm(capitalToCommit).format('0,0.00') }}
                  </div>
                  <div class="pt-3 text-argon-600/70 cursor-pointer">View Bitcoin Space (0.002 BTC)</div>
                </div>
                <div class="w-1/2">
                  <header class="text-lg font-bold text-slate-500/70 pb-2">
                    Estimated APY {{ optimisticAPY === minimumAPY ? '' : 'Range' }}
                  </header>
                  <div
                    v-if="optimisticAPY === minimumAPY"
                    class="border border-slate-500/30 rounded-lg py-9 text-4xl font-bold font-mono text-argon-600 shadow-sm"
                  >
                    {{ numeral(optimisticAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 9_999) }}%
                  </div>
                  <div
                    v-else
                    class="border border-slate-500/30 rounded-lg py-9 text-4xl font-bold font-mono text-argon-600 shadow-sm"
                  >
                    {{ numeral(optimisticAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 9_999) }}%
                    <span class="text-slate-500/80 font-normal text-xl relative -top-1 -mx-1">to</span>
                    {{ numeral(minimumAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 9_999) }}%
                  </div>
                  <div class="pt-3 text-argon-600/70 cursor-pointer">View Risk Analysis (100% key security)</div>
                </div>
              </section>

              <div class="flex flex-col relative grow px-5 text-lg">
                <section class="flex flex-row h-1/2 my-2">
                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="capitalDistribution"
                      v-if="showEditBoxOverlay === 'capitalDistribution'"
                      @close="showEditBoxOverlay = null"
                      class="-top-5 left-0"
                    />
                    <div
                      @click="openEditBoxOverlay('capitalDistribution')"
                      class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer"
                    >
                      <div class="font-bold text-slate-500/50">Capital Distribution</div>
                      <span class="text-argon-600 font-mono font-bold">
                        {{ numeral(capitalSecuritizationPct).format('0.[00]') }}% 
                        <span class="font-light">and</span>
                        {{ numeral(capitalLiquidityPct).format('0.[00]') }}%
                        <InfoOutlineIcon
                          class="w-4 h-4 text-slate-500/70 inline-block ml-1 left-1 relative top-[-1px]"
                        />
                      </span>
                    </div>
                  </div>
                  <div class="w-[1px] bg-slate-300 mx-2"></div>
                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="securitizationRatio"
                      v-if="showEditBoxOverlay === 'securitizationRatio'"
                      @close="showEditBoxOverlay = null"
                      class="-top-5 left-1/2 -translate-x-1/2"
                    />
                    <div
                      @click="openEditBoxOverlay('securitizationRatio')"
                      class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer"
                    >
                      <div class="font-bold text-slate-500/50">Securitization Ratio</div>
                      <span class="text-argon-600 font-mono font-bold">
                        {{ numeral(securitizationRatio).format('0.[00]') }}
                        <span class="font-light">to 1</span>
                        <InfoOutlineIcon
                          class="w-4 h-4 text-slate-500/70 inline-block ml-1 left-1 relative top-[-1px]"
                        />
                      </span>
                    </div>
                  </div>
                  <div class="w-[1px] bg-slate-300 mx-2"></div>
                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="externalProfitSharing"
                      v-if="showEditBoxOverlay === 'externalProfitSharing'"
                      @close="showEditBoxOverlay = null"
                      class="-top-5 right-0"
                    />
                    <div
                      @click="openEditBoxOverlay('externalProfitSharing')"
                      class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer"
                    >
                      <div class="font-bold text-slate-500/50">External Profit Sharing</div>
                      <span class="text-argon-600 font-mono font-bold">
                        {{ numeral(profitSharingPct).format('0.[00]') }}%
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
                      id="btcFlatFee"
                      v-if="showEditBoxOverlay === 'btcFlatFee'"
                      @close="showEditBoxOverlay = null"
                      class="bottom-[-10px] left-0"
                    />
                    <div
                      @click="openEditBoxOverlay('btcFlatFee')"
                      class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer"
                    >
                      <div class="font-bold text-slate-500/50">BTC Flat Fee</div>
                      <span class="text-argon-600 font-mono font-bold">
                        {{ currency.symbol }}{{ microgonToMoneyNm(btcFlatFee).format('0,0.00') }}
                        <InfoOutlineIcon
                          class="w-4 h-4 text-slate-500/70 inline-block ml-1 left-1 relative top-[-1px]"
                        />
                      </span>
                    </div>
                  </div>
                  <div class="w-[1px] bg-slate-300 mx-2"></div>
                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="btcVariableFee"
                      v-if="showEditBoxOverlay === 'btcVariableFee'"
                      @close="showEditBoxOverlay = null"
                      class="bottom-[-10px] left-1/2 -translate-x-1/2"
                    />
                    <div
                      @click="openEditBoxOverlay('btcVariableFee')"
                      class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer"
                    >
                      <div class="font-bold text-slate-500/50">BTC Variable Fee</div>
                      <span class="text-argon-600 font-mono font-bold">
                        {{ numeral(btcPctFee).format('0.[00]') }}%
                        <InfoOutlineIcon
                          class="w-4 h-4 text-slate-500/70 inline-block ml-1 left-1 relative top-[-1px]"
                        />
                      </span>
                    </div>
                  </div>
                  <div class="w-[1px] bg-slate-300 mx-2"></div>
                  <div class="flex flex-col items-center justify-center relative w-1/3">
                    <EditBoxOverlay
                      id="personalBtc"
                      v-if="showEditBoxOverlay === 'personalBtc'"
                      @close="showEditBoxOverlay = null"
                      class="bottom-[-10px] right-0"
                    />
                    <div
                      @click="openEditBoxOverlay('personalBtc')"
                      class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer"
                    >
                      <div class="font-bold text-slate-500/50">Personal BTC to Lock</div>
                      <span class="text-argon-600 font-mono font-bold">
                        {{ currency.symbol }}{{ microgonToMoneyNm(personalBtcValue).format('0,0.00') }}
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
                <span class="text-argon-600/70 cursor-pointer">View Existing Network Vaults</span>
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
                  <span v-if="!isSaving">{{ isBrandNew ? 'Create' : 'Update' }} Vault</span>
                  <span v-else>{{ isBrandNew ? 'Creating' : 'Updating' }} Vault...</span>
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
import { Dialog, DialogPanel, TransitionRoot, TransitionChild } from '@headlessui/vue';
import { useConfig } from '../stores/config';
import { getMainchain } from '../stores/mainchain';
import { useCurrency } from '../stores/currency';
import numeral, { createNumeralHelpers } from '../lib/numeral';
import BgOverlay from '../components/BgOverlay.vue';
import { XMarkIcon, LightBulbIcon } from '@heroicons/vue/24/outline';
import InfoOutlineIcon from '../assets/info-outline.svg?component';
import EditBoxOverlay, { type IEditBoxOverlayTypeForVault } from './EditBoxOverlay.vue';
import { MICROGONS_PER_ARGON as MICROGONS_PER_ARGON_MAINCHAIN } from '@argonprotocol/mainchain';
import BigNumber from 'bignumber.js';
import IVaultingRules from '../interfaces/IVaultingRules';

const MICROGONS_PER_ARGON = BigInt(MICROGONS_PER_ARGON_MAINCHAIN);

const mainchain = getMainchain();
const config = useConfig();
const currency = useCurrency();
const { microgonToMoneyNm } = createNumeralHelpers(currency);

const isBrandNew = Vue.ref(config.vaultingRules === null);
const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);
const isSaving = Vue.ref(false);

const showEditBoxOverlay = Vue.ref<IEditBoxOverlayTypeForVault | null>(null);

const dialogPanel = Vue.ref(null);

const capitalSecuritizationPct = Vue.ref(50);
const capitalLiquidityPct = Vue.ref(50);

const securitizationRatio = Vue.ref(1);

const profitSharingPct = Vue.ref(10);

const btcFlatFee = Vue.ref(2n * MICROGONS_PER_ARGON);
const btcPctFee = Vue.ref(10);

const personalBtcValue = Vue.ref(500n * MICROGONS_PER_ARGON);

const capitalToCommit = Vue.ref(2_000n * MICROGONS_PER_ARGON);

const minimumAPY = Vue.ref(0);
const optimisticAPY = Vue.ref(0);

function openEditBoxOverlay(type: IEditBoxOverlayTypeForVault) {
  showEditBoxOverlay.value = type;
}

function closeOverlay() {
  isOpen.value = false;
}

function calculateAPY(cost: number | bigint, revenue: number | bigint) {
  const profit = BigNumber(revenue).minus(cost);
  const tdpr = profit.dividedBy(cost).multipliedBy(100).toNumber();
  const apy = Math.pow(1 + tdpr / 100, 36.5) * 100 - 100;
  return Math.max(apy, -100);
}

async function saveRules() {
  isSaving.value = true;
  const rules: IVaultingRules = {
    requiredMicrogons: capitalToCommit.value,
    requiredMicronots: 0n,
  };

  config.vaultingRules = rules;
  await config.save();

  isSaving.value = false;
  closeOverlay();
}

emitter.on('openConfigureStabilizationVaultOverlay', async () => {
  if (isOpen.value) return;
  isLoaded.value = false;

  let minimumRevenue = 0n;
  let optimisticRevenue = 0n;

  // calculate profits from vault liquidity
  const liquidityPoolPayout = await mainchain.getLiquidityPoolPayout();
  const myTotalPoolCapital = BigNumber(capitalToCommit.value)
    .multipliedBy(capitalSecuritizationPct.value / 100)
    .toNumber();
  const totalPoolCapital = liquidityPoolPayout.totalActivatedCapital + myTotalPoolCapital;
  const myPctOfPool = BigNumber(myTotalPoolCapital).dividedBy(totalPoolCapital).toNumber();
  const vaultRevenueFromPool = BigInt(Math.floor(liquidityPoolPayout.totalBidAmount * myPctOfPool));

  const capitalPctFromFunding = 50 - capitalLiquidityPct.value;
  const capitalPayoutToContributors = BigInt(
    BigNumber(vaultRevenueFromPool)
      .multipliedBy(capitalPctFromFunding / 100)
      .multipliedBy(profitSharingPct.value / 100)
      .integerValue()
      .toString(),
  );
  const retainedRevenueFromPool = vaultRevenueFromPool - capitalPayoutToContributors;
  optimisticRevenue += retainedRevenueFromPool;

  const totalBtcSpace = BigInt(
    BigNumber(capitalToCommit.value)
      .multipliedBy(capitalSecuritizationPct.value / 100)
      .integerValue()
      .toString(),
  );
  const availableBtcSpace = BigNumber(totalBtcSpace).minus(personalBtcValue.value).toNumber();
  const revenueFromBtc = BigInt(
    BigNumber(availableBtcSpace)
      .multipliedBy(btcPctFee.value / 100)
      .integerValue()
      .toString(),
  );
  const appliedRevenueFromBtc = BigInt(BigNumber(revenueFromBtc).dividedBy(36.5).integerValue().toString());

  optimisticRevenue += appliedRevenueFromBtc;
  optimisticRevenue += availableBtcSpace > 0n ? btcFlatFee.value : 0n;

  // calculate profits from personal BTC liquidity
  const poolCapitalFromBtc = Math.min(
    BigNumber(personalBtcValue.value).multipliedBy(securitizationRatio.value).toNumber(),
    myTotalPoolCapital,
  );
  const myPctOfProfitsFromBtc = BigNumber(poolCapitalFromBtc).dividedBy(totalPoolCapital).toNumber();
  minimumRevenue += BigInt(Math.floor(liquidityPoolPayout.totalBidAmount * myPctOfProfitsFromBtc));

  optimisticAPY.value = calculateAPY(capitalToCommit.value, capitalToCommit.value + BigInt(optimisticRevenue));
  minimumAPY.value = calculateAPY(capitalToCommit.value, capitalToCommit.value + BigInt(minimumRevenue));

  isOpen.value = true;
  isLoaded.value = true;
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
