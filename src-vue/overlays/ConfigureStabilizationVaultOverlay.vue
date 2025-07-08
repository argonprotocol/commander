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
              {{ isBrandNew ? 'Create' : 'Update' }} Stabilization Vault
              <div @click="closeOverlay" class="absolute top-[22px] right-[0px] z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/70 hover:bg-[#D6D9DF]">
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
                  <div @mouseenter="showTooltip($event, tooltip.capitalToCommit, { width: 'parent' })" @mouseleave="hideTooltip" class="flex flex-col group cursor-pointer">
                    <header StatHeader class="group-hover:text-argon-600/70 relative z-10">Capital to Commit</header>
                    <div PrimaryStat class="border border-slate-500/30 rounded-lg -mt-7 pb-10 pt-12 group-hover:bg-argon-20 text-4xl font-bold font-mono text-argon-600 shadow-sm">
                      {{ currency.symbol }}{{ microgonToMoneyNm(capitalToCommit).format('0,0.00') }}
                    </div>
                  </div>
                  <div class="pt-3 text-argon-600/70 cursor-pointer">View Bitcoin Space ({{ numeral(btcSpaceAvailable).format('0,0.[00000000]') }} BTC)</div>
                </div>
                <div class="w-1/2">
                  <div @mouseenter="showTooltip($event, tooltip.estimatedAPYRange, { width: 'parent' })" @mouseleave="hideTooltip" class="flex flex-col group cursor-pointer">
                    <header StatHeader class="group-hover:text-argon-600/70 relative z-10">
                      Estimated APY {{ optimisticAPY === minimumAPY ? '' : 'Range' }}
                    </header>
                    <div PrimaryStat v-if="optimisticAPY === minimumAPY" class="border border-slate-500/30 rounded-lg -mt-7 pb-10 pt-12 group-hover:bg-argon-20 text-4xl font-bold font-mono text-argon-600 shadow-sm">
                      {{ numeral(optimisticAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 9_999) }}%
                    </div>
                    <div PrimaryStat v-else class="border border-slate-500/30 rounded-lg -mt-7 pb-10 pt-12 group-hover:bg-argon-20 text-4xl font-bold font-mono text-argon-600 shadow-sm">
                      {{ numeral(optimisticAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 9_999) }}%
                      <span class="text-slate-500/80 font-normal text-xl relative -top-1 -mx-1">to</span>
                      {{ numeral(minimumAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 9_999) }}%
                    </div>
                  </div>
                  <div class="pt-3 text-argon-600/70 cursor-pointer text-md">View Risk Analysis (99% from key security)</div>
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
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.capitalDistribution, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay('capitalDistribution')" class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer">
                      <div StatHeader>Capital Distribution</div>
                      <div class="flex flex-row items-center justify-center px-8 w-full text-center font-mono">
                        <div MainRule class="flex flex-row items-center justify-center w-5/12">
                          <span>{{ numeral(capitalSecuritizationPct).format('0.[00]') }}%</span>
                        </div>
                        <span class="text-md w-2/12 text-gray-500/60">&nbsp;vs&nbsp;</span>
                        <div MainRule class="flex flex-row items-center justify-center w-5/12">
                          <span>{{ numeral(capitalSecuritizationPct).format('0.[00]') }}%</span>
                        </div>
                      </div>
                      <div class="flex flex-row items-center justify-center px-10 w-full text-center font-mono ">
                        <div class="flex flex-row items-center justify-center text-md px-1 text-gray-500/60 w-5/12">
                          Security
                        </div>
                        <span class="text-md w-2/12 text-gray-500/60">&nbsp;</span>
                        <div class="flex flex-row items-center justify-center text-md text-gray-500/60 w-5/12">
                          Liquidity
                        </div>
                      </div>
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
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.securitizationRatio, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay('securitizationRatio')" class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer">
                      <div StatHeader>Securitization Ratio</div>
                      <div MainRule class="w-full">
                        {{ numeral(securitizationRatio).format('0.[00]') }}
                        <span class="font-light">to</span>
                        1
                      </div>
                      <div class="text-gray-500/60 text-md font-mono">
                        Collateral for Bitcoin
                      </div>
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
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.externalProfitSharing, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay('externalProfitSharing')" class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer">
                      <div StatHeader>External Profit Sharing</div>
                      <div MainRule class="w-full">
                        {{ numeral(profitSharingPct).format('0.[00]') }}%
                      </div>
                      <div class="text-gray-500/60 text-md font-mono">
                        Paid to Contributors
                      </div>
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
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.btcFlatFee, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay('btcFlatFee')" class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer">
                      <div StatHeader>BTC Flat Fee</div>
                      <div MainRule class="w-full">
                        {{ currency.symbol }}{{ microgonToMoneyNm(btcFlatFee).format('0,0.00') }}
                      </div>
                      <div class="text-gray-500/60 text-md font-mono">
                        Per Transaction
                      </div>
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
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.btcVariableFee, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay('btcVariableFee')" class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer">
                      <div StatHeader>BTC Variable Fee</div>
                      <div MainRule class="w-full">
                        {{ numeral(btcPctFee).format('0.[00]') }}%
                      </div>
                      <div class="text-gray-500/60 text-md font-mono">
                        Of Value Locked
                      </div>
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
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.personalBtc, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay('personalBtc')" class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer">
                      <div StatHeader>Personal BTC to Lock</div>
                      <div MainRule class="w-full">
                        {{ currency.symbol }}{{ microgonToMoneyNm(personalBtcValue).format('0,0.00') }}
                      </div>
                      <div class="text-gray-500/60 text-md font-mono">
                        At Current Market Price
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div class="flex flex-row justify-end border-t border-slate-300 mx-4 py-4 space-x-4 rounded-b-lg">
              <div class="flex flex-row space-x-4 justify-center items-center">
                <span class="text-argon-600/70 cursor-pointer mr-10">Show Existing Network Vaults</span>
                <button @click="closeOverlay" class="border border-argon-button text-xl font-bold text-gray-500 px-7 py-1 rounded-md cursor-pointer">
                  <span>Cancel</span>
                </button>
                <button @click="saveRules" @mouseenter="showTooltip($event, tooltip.saveRules, { width: 'parent' })" @mouseleave="hideTooltip" class="bg-argon-button text-xl font-bold text-white px-7 py-1 rounded-md cursor-pointer">
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
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { showTooltip, hideTooltip } from '../lib/TooltipUtils';
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

const btcSpaceAvailable = Vue.computed(() => {
  const microgonsForSecuritization = BigNumber(capitalToCommit.value)
    .multipliedBy(capitalSecuritizationPct.value / 100)
    .toNumber();
  const btcSpaceInMicrogonsBn = BigNumber(microgonsForSecuritization).dividedBy(securitizationRatio.value);
  const btcSpaceInMicrogons = BigInt(btcSpaceInMicrogonsBn.integerValue().toString());
  return currency.microgonToBtc(btcSpaceInMicrogons);
});

const tooltip = {
  capitalToCommit:
    'The more capital you commit, the more liquidity your provides to the network and therefore the higher your potential returns.',
  estimatedAPYRange:
    'These estimates are based on a combination of current pool rewards and the vault parameters you have configured below.',
  capitalDistribution:
    'This is how your capital will be split between securitization and liquidity. Each delivers different return rates and yet both work together.',
  securitizationRatio:
    'This is the ratio of argons to bitcoins that you are committing. These argons guarantee the bitcoin holders that their assets are safe.',
  externalProfitSharing:
    'Outside funders can contribute to your liquidity capital, and in return you agree to share a portion of your profits with them.',
  btcFlatFee: 'Each bitcoin transaction that locks in your vault must pay this flat fee for doing so.',
  btcVariableFee: `In addition to the flat fee, each bitcoin transaction must pay this percentage of their bitcoin's current market value.`,
  personalBtc: `You'll probably want to bootstrap your vault with some of your own bitcoin. The more bitcoin, the faster you'll start earning returns.`,
  saveRules: 'You can update these settings later.',
};

function openEditBoxOverlay(type: IEditBoxOverlayTypeForVault) {
  showEditBoxOverlay.value = type;
}

function closeOverlay() {
  hideTooltip();
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

function updateAPYs() {
  // Placeholder for future APY calculation logic if needed
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
