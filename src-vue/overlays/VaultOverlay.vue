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
          class="VaultOverlay absolute top-[40px] left-3 right-3 bottom-3 flex flex-col rounded-md border border-black/30 inner-input-shadow bg-argon-menu-bg text-left z-20 transition-all focus:outline-none"
          style="box-shadow: 0px -1px 2px 0 rgba(0, 0, 0, 0.1), inset 0 2px 0 rgba(255, 255, 255, 1);">
          <BgOverlay v-if="editBoxOverlayId" @close="editBoxOverlayId = null" :showWindowControls="false" rounded="md" class="z-100" />
          <div class="flex flex-col h-full w-full">
            <h2
              class="relative text-3xl font-bold text-left border-b border-slate-300 pt-5 pb-4 pl-3 mx-4 cursor-pointer text-[#672D73]"
              style="box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1)"
            >
              <DialogTitle as="div" class="relative z-10">{{ isBrandNew ? 'Create' : 'Update' }} Stabilization Vault</DialogTitle>
              <div @click="cancelOverlay" class="absolute top-[22px] right-[0px] z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/70 hover:bg-[#D6D9DF]">
                <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
              </div>
            </h2>

            <div v-if="isLoaded" class="flex flex-col grow relative w-full">
              <DialogDescription class="opacity-80 font-light py-6 pl-10 pr-[6%]">
                Vaults are special holding mechanisms within Argon that stabilize its stablecoin and provide liquidity to the broader network. You can earn
                revenue by creating and managing these vaults.
              </DialogDescription>

              <section class="flex flex-row border-t border-b border-slate-300 text-center pt-8 pb-8 px-3.5 mx-5 justify-stretch">
                <div class="w-1/2 flex flex-col grow">
                  <div PrimaryStat class="flex flex-col grow group border border-slate-500/30 rounded-lg shadow-sm">
                    <header StatHeader class="mx-4 relative z-10">
                      Capital {{ isBrandNew ? 'to Commit' : 'Committed' }}
                    </header>
                    <div class="grow relative mt-2 pb-12 pt-10 text-5xl font-bold font-mono text-argon-600">
                      <!-- <NeedMoreCapitalHover v-if="probableMinSeats < rules.seatGoalCount" :calculator="calculator" /> -->
                      <InputArgon v-model="rules.baseCapitalCommitment" :min="10_000_000n" :minDecimals="0" class="focus:outline-none" />
                    </div>
                  </div>
                  <div class="pt-3 text-md">
                    <span class="cursor-pointer text-argon-600/50 hover:text-argon-600/80">View Bitcoin Space ({{ numeral(btcSpaceAvailable).format('0,0.[00000000]') }} BTC)</span>
                  </div>
                </div>
                
                <div class="flex flex-col items-center justify-center text-3xl mx-2 text-center">
                  <span class="relative -top-1 opacity-50">
                    =
                  </span>
                </div>
                
                <div class="w-1/2 flex flex-col grow">
                  <!-- @mouseenter="showTooltip($event, tooltip.estimatedAPYRange, { width: 'parent' })" @mouseleave="hideTooltip"  -->
                  <div PrimaryStat class="flex flex-col grow group border border-slate-500/30 rounded-lg shadow-sm">
                    <header StatHeader class="mx-4 relative z-10">Annual Percentage Yields</header>
                    <div class="grow flex flex-col mt-3 w-full px-4">
                      <table class="w-full h-full table-fixed relative z-50 whitespace-nowrap -mt-1">
                        <tbody>
                          <tr class="text-argon-600 h-1/3">
                            <td class="w-5/12"></td>
                            <td class="font-light font-sans text-argon-800/40 w-5/12">Low Utilization</td>
                            <td class="font-light font-sans text-argon-800/40 w-5/12">High Utilization</td>
                          </tr>
                          <tr class="font-bold font-mono text-argon-600 h-1/3">
                            <td class="font-light font-sans text-argon-800/40 border-t border-dashed border-slate-300 text-left pl-2 pr-10">Proj. Vault Profits</td>
                            <td class="text-lg border-t border-dashed border-slate-300">
                              <Tooltip :content="`This is the vault's expected profit if the lowest resource utilization is achieved. You can adjust these utilization projections in the box below.`">
                                {{ numeral(vaultLowUtilizationAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 999_999) }}%
                              </Tooltip>
                            </td>
                            <td class="text-lg border-t border-dashed border-slate-300">
                              <Tooltip :content="``">
                                {{ numeral(vaultHighUtilizationAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 999_999) }}%
                              </Tooltip>
                            </td>
                          </tr>
                          <tr class="font-bold font-mono text-argon-600 h-1/3">
                            <td class="font-light font-sans text-argon-800/40 border-t border-dashed border-slate-300 text-left pl-2 pr-10">Proj. External Profits</td>
                            <td class="text-lg border-t border-dashed border-slate-300">
                              <Tooltip v-if="hasExternalPoolCapitalLow" :content="`This is the expected profits of those who help fund your liquidity pool capital. It is based on the minimum Resource Utilization projections.`">
                                {{ numeral(externalLowUtilizationAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 999_999) }}%
                              </Tooltip>
                              <span v-else>n/a</span>
                            </td>
                            <td class="text-lg border-t border-dashed border-slate-300">
                              <Tooltip v-if="hasExternalPoolCapitalHigh" :content="`If your bids are accepted at the starting price and the tokens grow at their fastest projected rate (which you can change in Ecosystem Growth) then this is your return.`">
                                {{ numeral(externalHighUtilizationAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 999_999) }}%
                              </Tooltip>
                              <span v-else>n/a</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div class="pt-3 text-md">
                    <span class="cursor-pointer text-argon-600/50 hover:text-argon-600/80">View Risk Analysis (99% from key security)</span>
                  </div>
                </div>
              </section>

              <div class="flex flex-col relative grow px-5 text-lg">
                <section class="flex flex-row h-1/2 my-2">

                  <div MainWrapperParent class="flex flex-col items-center justify-center relative w-1/3">
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.securitizationRatio, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay($event, 'securitizationRatio')" class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer">
                      <div StatHeader>Securitization Ratio</div>
                      <div MainRule class="w-full">
                        {{ numeral(rules.securitizationRatio).format('0.[00]') }}
                        <span class="font-light">to</span>
                        1
                      </div>
                      <div class="text-gray-500/60 text-md font-mono">
                        Collateral for Bitcoin
                      </div>
                    </div>
                  </div>

                  <div class="w-[1px] bg-slate-300 mx-2"></div>

                  <div MainWrapperParent class="flex flex-col items-center justify-center relative w-1/3">
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.capitalDistribution, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay($event, 'capitalDistribution')" class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer">
                      <div StatHeader>Capital Distribution</div>
                      <div class="flex flex-row items-center justify-center px-8 w-full text-center font-mono">
                        <div MainRule class="flex flex-row items-center justify-center w-5/12">
                          <span>{{ numeral(rules.capitalForSecuritizationPct).format('0.[00]') }}%</span>
                        </div>
                        <span class="text-md w-2/12 text-gray-500/60">&nbsp;vs&nbsp;</span>
                        <div MainRule class="flex flex-row items-center justify-center w-5/12">
                          <span>{{ numeral(rules.capitalForLiquidityPct).format('0.[00]') }}%</span>
                        </div>
                      </div>
                      <div class="flex flex-row items-center justify-center px-8 w-full text-center font-mono ">
                        <div class="flex flex-row items-center justify-center text-md px-1 text-gray-500/60 w-5/12 whitespace-nowrap">
                          BTC Security
                        </div>
                        <span class="text-md w-2/12 text-gray-500/60">&nbsp;</span>
                        <div class="flex flex-row items-center justify-center text-md text-gray-500/60 w-5/12 whitespace-nowrap">
                          Pool Liquidity
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="w-[1px] bg-slate-300 mx-2"></div>

                  <div MainWrapperParent class="flex flex-col items-center justify-center relative w-1/3">
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.poolRevenueShare, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay($event, 'poolRevenueShare')" class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer">
                      <div StatHeader>Pool Revenue Share</div>
                      <div MainRule class="w-full">
                        {{ numeral(100 - rules.profitSharingPct).format('0.[00]') }}% <span class="opacity-40 font-light">/</span> {{ numeral(rules.profitSharingPct).format('0.[00]') }}%
                      </div>
                      <div class="text-gray-500/60 text-md font-mono">
                        Internal to External Split
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
                  <div MainWrapperParent class="flex flex-col items-center justify-center relative w-1/3">
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.btcLockingFees, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay($event, 'btcLockingFees')" class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer">
                      <div StatHeader>BTC Locking Fee</div>
                      <div MainRule class="w-full">
                        {{ currency.symbol }}{{ microgonToMoneyNm(rules.btcFlatFee).format('0,0.00') }} + {{ numeral(rules.btcPctFee).format('0.[00]') }}%
                      </div>
                      <div class="text-gray-500/60 text-md font-mono">
                        Per Transaction
                      </div>
                    </div>
                  </div>

                  <div class="w-[1px] bg-slate-300 mx-2"></div>

                  <div MainWrapperParent class="flex flex-col items-center justify-center relative w-1/3">
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.projectedUtilization, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay($event, 'projectedUtilization')" class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer">
                      <div StatHeader>Projected Utilization</div>
                      <div class="flex flex-row items-center justify-center px-8 w-full text-center font-mono">
                        <div MainRule class="flex flex-row items-center justify-center w-5/12">
                          <span>{{ rules.btcUtilizationPctMin }}%</span>
                          <span class="text-md px-1.5 text-gray-500/60">to</span>
                          <span>{{ rules.btcUtilizationPctMax }}%</span>
                        </div>
                        <span class="text-md w-2/12 text-gray-500/60">&nbsp;and&nbsp;</span>
                        <div MainRule class="flex flex-row items-center justify-center w-5/12">
                          <span>{{ rules.poolUtilizationPctMin }}%</span>
                          <span class="text-md px-1.5 text-gray-500/60">to</span>
                          <span>{{ rules.poolUtilizationPctMax }}%</span>
                        </div>
                      </div>
                      <div class="flex flex-row items-center justify-center px-10 w-full text-center font-mono ">
                        <div class="flex flex-row items-center justify-center text-md px-1 text-gray-500/60 w-5/12">
                          BTC Usage
                        </div>
                        <span class="text-md w-2/12 text-gray-500/60">&nbsp;</span>
                        <div class="flex flex-row items-center justify-center text-md text-gray-500/60 w-5/12">
                          Pool Usage
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="w-[1px] bg-slate-300 mx-2"></div>

                  <div MainWrapperParent class="flex flex-col items-center justify-center relative w-1/3">
                    <div MainWrapper @mouseenter="showTooltip($event, tooltip.personalBtc, { width: 'parent', widthPlus: 16 })" @mouseleave="hideTooltip" @click="openEditBoxOverlay($event, 'personalBtc')" class="flex flex-col w-full h-full hover:bg-argon-100/20 items-center justify-center cursor-pointer">
                      <div StatHeader>Personal BTC to Lock</div>
                      <div MainRule class="w-full">
                        {{ currency.symbol }}{{ microgonToMoneyNm(rules.personalBtcInMicrogons).format('0,0.00') }}
                      </div>
                      <div class="text-gray-500/60 text-md font-mono">
                        At Current Market Price
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
            <div v-else>Loading...</div>

            <div class="flex flex-row justify-end border-t border-slate-300 mx-4 py-4 space-x-4 rounded-b-lg">
              <div class="flex flex-row space-x-4 justify-center items-center">
                <ExistingNetworkVaultsOverlayButton class=" mr-10" />
                <button @click="cancelOverlay" class="border border-argon-button/50 text-xl font-bold text-gray-500 px-7 py-1 rounded-md cursor-pointer">
                  <span>Cancel</span>
                </button>
                <button @click="saveRules" @mouseenter="showTooltip($event, tooltip.saveRules, { width: 'parent' })" @mouseleave="hideTooltip" class="bg-argon-button text-xl font-bold text-white px-7 py-1 rounded-md cursor-pointer">
                  <span v-if="!isSaving">{{ isBrandNew ? 'Create' : 'Update' }} Vault</span>
                  <span v-else>{{ isBrandNew ? 'Creating' : 'Updating' }} Vault...</span>
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
import basicEmitter from '../emitters/basicEmitter';
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, DialogDescription } from 'reka-ui';
import Tooltip from '../components/Tooltip.vue';
import { useConfig } from '../stores/config';
import { getMainchain } from '../stores/mainchain';
import { useCurrency } from '../stores/currency';
import numeral, { createNumeralHelpers } from '../lib/numeral';
import BgOverlay from '../components/BgOverlay.vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { hideTooltip, showTooltip } from '../lib/TooltipUtils';
import EditBoxOverlay, { type IEditBoxOverlayTypeForVaulting } from './EditBoxOverlay.vue';
import { jsonParseWithBigInts } from '@argonprotocol/commander-core';
import IVaultingRules from '../interfaces/IVaultingRules';
import { MyVault } from '../lib/MyVault.ts';
import InputArgon from '../components/InputArgon.vue';
import ExistingNetworkVaultsOverlayButton from './ExistingNetworkVaultsOverlayButton.vue';
import { VaultCalculator } from '../lib/VaultCalculator.ts';
import { jsonStringifyWithBigInts } from '@argonprotocol/commander-core';

const mainchain = getMainchain();
const config = useConfig();
const currency = useCurrency();
const { microgonToMoneyNm } = createNumeralHelpers(currency);

let previousVaultingRules: string | null = null;

const rules = Vue.computed(() => {
  return config.vaultingRules as IVaultingRules;
});

const calculator = new VaultCalculator(mainchain);

const isBrandNew = Vue.ref(true);
const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);
const isSaving = Vue.ref(false);

const editBoxOverlayId = Vue.ref<IEditBoxOverlayTypeForVaulting | null>(null);
const editBoxOverlayPosition = Vue.ref<{ top?: number; left?: number; width?: number } | undefined>(undefined);
const dialogPanel = Vue.ref(null);

const vaultLowUtilizationAPY = Vue.ref(0);
const vaultHighUtilizationAPY = Vue.ref(0);
const externalLowUtilizationAPY = Vue.ref(0);
const externalHighUtilizationAPY = Vue.ref(0);

const btcSpaceAvailable = Vue.ref(0);

const hasExternalPoolCapitalLow = Vue.ref(false);
const hasExternalPoolCapitalHigh = Vue.ref(false);

const tooltip = {
  capitalToCommit:
    'The more capital you commit, the more liquidity your provides to the network and therefore the higher your potential returns.',
  estimatedAPYRange:
    'These estimates are based on a combination of current pool rewards and the vault parameters you have configured below.',
  capitalDistribution:
    'This is how your capital will be split between securitization and liquidity. Each delivers different return rates and yet both work together.',
  securitizationRatio:
    'This is the ratio of argons to bitcoins that you are committing. These argons guarantee the bitcoin holders that their assets are safe.',
  poolRevenueShare:
    'Outside funders can contribute to your liquidity capital, and in return you agree to share a portion of your profits with them.',
  btcLockingFees: 'Each bitcoin transaction that locks in your vault must pay this flat fee for doing so.',
  projectedUtilization: `In addition to the flat fee, each bitcoin transaction must pay this percentage of their bitcoin's current market value.`,
  personalBtc: `You'll probably want to bootstrap your vault with some of your own bitcoin. The more bitcoin, the faster you'll start earning returns.`,
  saveRules: 'You can update these settings later.',
};

function openEditBoxOverlay($event: MouseEvent, type: IEditBoxOverlayTypeForVaulting) {
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
  console.log('CANCEL OVERLAY');
  isOpen.value = false;
  hideTooltip();

  if (previousVaultingRules) {
    config.vaultingRules = jsonParseWithBigInts(previousVaultingRules) as IVaultingRules;
  }
}

async function saveRules() {
  isSaving.value = true;

  if (rules.value) {
    // validate the personal btc fits into the securitization space
    const { microgonsForSecuritization } = MyVault.getMicrogoonSplit(rules.value);
    const availableBtcSpace = BigInt(
      BigNumber(microgonsForSecuritization).dividedBy(rules.value.securitizationRatio).integerValue().toNumber(),
    );
    // TODO: determine how the UI should handle things like this
    // TODO: don't allow personal btc to exceed the liquidity space either
    if (rules.value.personalBtcInMicrogons > availableBtcSpace) {
      alert(
        `Your personal BTC value (${currency.symbol}${microgonToMoneyNm(rules.value.personalBtcInMicrogons).format('0,0.[00000000]')}) exceeds the available securitization space (${currency.symbol}${microgonToMoneyNm(microgonsForSecuritization).format('0,0.[00000000]')}). Please adjust your settings.`,
      );
      rules.value.personalBtcInMicrogons = availableBtcSpace;

      return;
    }

    await config.saveVaultingRules();
  }

  isSaving.value = false;
  isOpen.value = false;
  hideTooltip();
}

function updateAPYs() {
  const btcSpaceInMicrogons = calculator.calculateBtcSpaceInMicrogons();
  btcSpaceAvailable.value = currency.microgonToBtc(btcSpaceInMicrogons);

  vaultLowUtilizationAPY.value = calculator.calculateInternalAPY('Low');
  vaultHighUtilizationAPY.value = calculator.calculateInternalAPY('High');
  externalLowUtilizationAPY.value = calculator.calculateExternalAPY('Low');
  externalHighUtilizationAPY.value = calculator.calculateExternalAPY('High');

  hasExternalPoolCapitalLow.value = calculator.calculateExternalPoolCapital('Low') > 0;
  hasExternalPoolCapitalHigh.value = calculator.calculateExternalPoolCapital('High') > 0;
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

basicEmitter.on('openVaultOverlay', async () => {
  if (isOpen.value) return;
  isLoaded.value = false;
  isBrandNew.value = !config.hasSavedVaultingRules;

  await calculator.load(rules.value);
  previousVaultingRules = jsonStringifyWithBigInts(config.vaultingRules);
  updateAPYs();

  isLoaded.value = true;
  isOpen.value = true;
});
</script>

<style>
@reference "../main.css";

.VaultOverlay {
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

    [StatHeader] {
      @apply group-hover:text-[#a08fb7];
      background: linear-gradient(
        to right,
        transparent 0%,
        oklch(0.88 0.09 320 / 0.2) 10%,
        oklch(0.88 0.09 320 / 0.2) 90%,
        transparent 100%
      );
      text-shadow: 1px 1px 0 white;
    }

    &::before {
      @apply from-argon-menu-bg bg-gradient-to-b from-[0px] to-transparent;
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

  [PrimaryStat] {
    div {
      @apply inline-block;
    }
    div[InputFieldWrapper] {
      @apply text-argon-600 border-none font-mono text-6xl font-bold !outline-none hover:bg-transparent focus:!outline-none;
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
