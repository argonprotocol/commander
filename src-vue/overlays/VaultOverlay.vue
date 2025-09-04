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
              <DialogTitle as="div" class="relative z-10">Configure Your Stabilization Vault</DialogTitle>
              <div @click="cancelOverlay" class="absolute top-[22px] right-[0px] z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/70 hover:bg-[#D6D9DF]">
                <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
              </div>
            </h2>

            <div v-if="isLoaded" class="flex flex-col grow relative w-full">
              <DialogDescription class="opacity-80 font-light py-6 pl-10 pr-[6%]">
                Vaults are special holding mechanisms that stabilize the Argon stablecoin and provide liquidity to the broader network. You can earn
                revenue by creating and managing these vaults. Use the screen below to configure your vault.
              </DialogDescription>

              <section class="flex flex-row border-t border-b border-slate-500/30 text-center pt-8 pb-8 px-3.5 mx-5 justify-stretch">
                <div class="w-1/2 flex flex-col grow">
                  <CapitalOverlay align="start" :width="capitalBoxWidth">
                    <div PrimaryStat @mouseenter="capitalBoxWidth = calculateElementWidth($event?.target as HTMLElement)" class="flex flex-col grow group border border-slate-500/30 rounded-lg shadow-sm">
                      <header StatHeader class="mx-0.5 pt-5 pb-0 relative">
                        Capital {{ isBrandNew ? 'to Commit' : 'Committed' }}
                      </header>
                      <div class="grow flex flex-col mt-3 border-t border-slate-500/30 border-dashed w-10/12 mx-auto">
                        <div class="text-gray-500/60 border-b border-slate-500/30 border-dashed py-3 w-full">
                          You are creating a new vault with a total capital value of
                        </div>
                        <div class="flex flex-row items-center justify-center grow relative h-26 font-bold font-mono text-argon-600">
                          <InputArgon v-model="rules.baseMicrogonCommitment" :min="1_000_000_000n" :minDecimals="0" class="focus:outline-none" />
                        </div>
                        <div class="text-gray-500/60 border-t border-slate-500/30 border-dashed py-5 w-full mx-auto">
                          This capital will allow you to secure {{ numeral(btcSpaceAvailable).format('0,0.[00000000]') }} in BTC<br/>
                          with a corresponding treasury pool investment of {{ microgonToArgonNm(poolSpace).format('0,0.[00]') }} argons.
                        </div>
                      </div>
                    </div>
                  </CapitalOverlay>
                </div>

                <div class="flex flex-col items-center justify-center text-3xl mx-2 text-center">
                  <span class="relative -top-1 opacity-50">
                    =
                  </span>
                </div>

                <div class="w-1/2 flex flex-col grow">
                  <ReturnsOverlay align="end" :width="returnsBoxWidth">
                    <div PrimaryStat @mouseenter="returnsBoxWidth = calculateElementWidth($event?.target as HTMLElement)" class="flex flex-col grow group border border-slate-500/30 rounded-lg shadow-sm">
                      <header StatHeader class="mx-0.5 pt-5 pb-0 relative">
                        Return on Capital
                      </header>
                      <div class="grow flex flex-col mt-3 border-t border-slate-500/30 border-dashed w-10/12 mx-auto">
                        <div class="text-gray-500/60 border-b border-slate-500/30 border-dashed py-3 w-full">
                          Your vault is set to earn {{ currency.symbol }}{{ microgonToMoneyNm(averageEarnings).format('0,0.00') }} this year with an APY of
                        </div>
                        <div class="flex flex-row items-center justify-center grow relative h-26 text-6xl font-bold font-mono text-argon-600">
                          {{ numeral(averageAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 999_999) }}%
                        </div>
                        <div class="text-gray-500/60 border-t border-slate-500/30 border-dashed py-5 w-full">
                        This represents an average of your estimated vaulting<br/>
                        returns,
                        <template v-if="vaultLowUtilizationAPY < 999_999 || vaultHighUtilizationAPY < 999_999">
                          which range between
                          {{ numeral(vaultLowUtilizationAPY).formatIfElseCapped('>=100', '0,0', '0,0.[00]', 999_999) }}%
                          and {{ numeral(vaultHighUtilizationAPY).formatIfElseCapped('>=100', '0,0', '0,0.[00]', 999_999) }}% APY.
                        </template>
                        <template v-else>
                          all which are above 999,999% APY.
                        </template>
                      </div>
                      </div>
                    </div>
                  </ReturnsOverlay>                  
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
                          Treasury Pool
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
                          Security Usage
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
                  <span v-if="!isSaving">{{ isBrandNew ? 'Initialize' : 'Update' }} Rules</span>
                  <span v-else>{{ isBrandNew ? 'Initializing' : 'Updating' }} Rules...</span>
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
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import { useConfig } from '../stores/config';
import { getMainchainClients, getMining } from '../stores/mainchain';
import { useCurrency } from '../stores/currency';
import numeral, { createNumeralHelpers } from '../lib/numeral';
import BgOverlay from '../components/BgOverlay.vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { hideTooltip, showTooltip } from '../lib/TooltipUtils';
import EditBoxOverlay, { type IEditBoxOverlayTypeForVaulting } from './EditBoxOverlay.vue';
import { JsonExt } from '@argonprotocol/commander-core';
import IVaultingRules from '../interfaces/IVaultingRules';
import { MyVault } from '../lib/MyVault.ts';
import InputArgon from '../components/InputArgon.vue';
import ExistingNetworkVaultsOverlayButton from './ExistingNetworkVaultsOverlayButton.vue';
import { VaultCalculator } from '../lib/VaultCalculator.ts';
import CapitalOverlay from './vault/VaultCapital.vue';
import ReturnsOverlay from './vault/VaultReturns.vue';

const mainchainClients = getMainchainClients();
const config = useConfig();
const currency = useCurrency();
const { microgonToMoneyNm, microgonToArgonNm } = createNumeralHelpers(currency);

let previousVaultingRules: string | null = null;

const rules = Vue.computed(() => {
  return config.vaultingRules as IVaultingRules;
});

const calculator = new VaultCalculator(mainchainClients);

const isBrandNew = Vue.ref(true);
const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);
const isSaving = Vue.ref(false);

const capitalBoxWidth = Vue.ref('');
const returnsBoxWidth = Vue.ref('');

const averageAPY = Vue.ref(0);
const averageEarnings = Vue.ref(0n);

const editBoxOverlayId = Vue.ref<IEditBoxOverlayTypeForVaulting | null>(null);
const editBoxOverlayPosition = Vue.ref<{ top?: number; left?: number; width?: number } | undefined>(undefined);
const dialogPanel = Vue.ref(null);

const vaultLowUtilizationAPY = Vue.ref(0);
const vaultHighUtilizationAPY = Vue.ref(0);
const externalLowUtilizationAPY = Vue.ref(0);
const externalHighUtilizationAPY = Vue.ref(0);

const btcSpaceAvailable = Vue.ref(0);
const poolSpace = Vue.ref(0n);

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

function calculateElementWidth(element: HTMLElement) {
  return element.getBoundingClientRect().width + 'px';
}

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

  hideTooltip();
  isOpen.value = false;

  if (previousVaultingRules) {
    config.vaultingRules = JsonExt.parse<IVaultingRules>(previousVaultingRules);
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

  averageAPY.value = (vaultLowUtilizationAPY.value + vaultHighUtilizationAPY.value) / 2;

  const highVaultRevenue = calculator.calculateInternalRevenue('High');
  const lowVaultRevenue = calculator.calculateInternalRevenue('Low');
  averageEarnings.value = (highVaultRevenue + lowVaultRevenue) / 2n;

  poolSpace.value = calculator.calculateTotalPoolSpace('High');
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
  previousVaultingRules = JsonExt.stringify(config.vaultingRules);
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
