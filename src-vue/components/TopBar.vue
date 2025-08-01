<!-- prettier-ignore -->
<template>
  <div
    class="bg-white/95 min-h-14 w-full flex flex-row items-center select-none"
    style="border-radius: 10px 10px 0 0; box-shadow: 0 2px 2px rgba(0, 0, 0, 0.2)"
    data-tauri-drag-region
  >
    <div class="flex flex-row items-center w-1/2 pointer-events-none">
      <WindowControls />
      <div class="text-xl font-bold">
        Argon Commander
        <span class="font-light text-lg">({{ NETWORK_NAME }}<template v-if="INSTANCE_NAME !== 'default'">, {{ INSTANCE_NAME.slice(0, 5) }}<template v-if="INSTANCE_NAME.length > 5">...</template></template>)</span>
      </div>
    </div>

    <div class="flex-grow flex justify-center pointer-events-none">
      <ul
        class="TOGGLE flex flex-row fit-content bg-[#E9EBF1] border border-[#b8b9bd] rounded text-center text-slate-600 pointer-events-auto"
      >
        <li
          class="border-r border-slate-400"
          @click="controller.setPanel('mining')"
          :class="{ selected: controller.panel === 'mining' }"
        >
          <span class="relative px-2 text-center">
            <div :class="{ invisible: controller.panel === 'mining' }">Mining</div>
            <div v-if="controller.panel === 'mining'" class="absolute top-0 left-0 w-full h-full font-bold">Mining</div>
          </span>
        </li>
        <li @click="controller.setPanel('vaulting')" :class="{ selected: controller.panel === 'vaulting' }">
          <span class="relative px-1 text-center">
            <div :class="{ invisible: controller.panel === 'vaulting' }">Vaulting</div>
            <div v-if="controller.panel === 'vaulting'" class="absolute top-0 left-0 w-full h-full font-bold">
              Vaulting
            </div>
          </span>
        </li>
      </ul>
    </div>

    <div class="flex flex-row mr-1 space-x-1 items-center justify-end w-1/2 pointer-events-none">
      <div
        v-if="wallets.isLoaded"
        :class="walletControlPopoverIsOpen || currencyMenuIsOpen ? 'border-slate-400/50' : 'border-transparent'"
        class="flex flex-row items-center border hover:border-slate-400/50 rounded-md group"
      >
        <CurrencyMenu @currencyMenuIsOpen="x => (currencyMenuIsOpen = x)" />

        <div class="bg-slate-400/50 w-[1px] h-[28px]"></div>

        <Popover v-slot="{ open }" class="relative pointer-events-auto">
          <PopoverButton
            class="relative flex flex-row text-xl font-bold text-[#B74CBA] pt-[1px] pl-[14px] pr-[10px] mr-[0px] h-[30px] items-center hover:bg-slate-400/10 cursor-pointer focus-visible:outline-none"
          >
            {{ microgonToMoneyNm(wallets.totalNetWorth).formatIfElse('< 1_000', '0,0.00', '0,0') }}
          </PopoverButton>
          <transition
            enter-active-class="transition ease-out duration-200"
            enter-from-class="opacity-0 translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition ease-in duration-150"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 translate-y-1"
          >
            <PopoverPanel
              ref="walletControlPopoverElem"
              v-slot="{ close }"
              class="absolute -right-2 z-[1000] mt-2 flex w-screen max-w-min"
            >
              <div class="absolute -top-[15px] right-[20px] w-[30px] h-[15px] overflow-hidden pointer-events-none">
                <div
                  class="relative top-[5px] left-[5px] w-[20px] h-[20px] rotate-45 bg-white ring-1 ring-gray-900/20"
                ></div>
              </div>
              <div
                class="flex flex-row shrink rounded bg-white text-sm/6 font-semibold text-gray-900 shadow-lg py-1 px-1 ring-1 ring-gray-900/20"
              >
                <section
                  @click="() => openWalletOverlay('mining', close)"
                  class="relative flex flex-col items-center w-80 pt-7 px-6 hover:bg-argon-menu-hover/70 cursor-pointer"
                >
                  <header class="text-lg font-bold text-gray-900">Mining Resources</header>
                  <div class="relative">
                    <MiningWalletIcon class="w-12 h-12 mt-5" />
                  </div>
                  <span class="text-4xl font-bold mt-5">
                    <span>
                      {{ currency.symbol
                      }}{{ microgonToMoneyNm(wallets.totalMiningResources).format('0,0.00').split('.')[0] }}
                    </span>
                    <span class="opacity-50">
                      .{{ microgonToMoneyNm(wallets.totalMiningResources).format('0.00').split('.')[1] }}
                    </span>
                  </span>

                  <div class="relative text-sm text-gray-500 flex flex-row w-full justify-center pb-8">
                    <CopyToClipboard
                      @click.stop
                      :content="wallets.miningWallet.address"
                      class="flex flex-row relative items-center justify-center hover:bg-white rounded-full px-6 py-1 cursor-pointer"
                    >
                      {{ abreviateAddress(wallets.miningWallet.address) }}
                      <CopyIcon class="w-3 h-3 ml-1 inline-block" />
                      <template #copied>
                        <div
                          class="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-row items-center justify-center"
                        >
                          {{ abreviateAddress(wallets.miningWallet.address) }}
                          <CopyIcon class="w-3 h-3 ml-1 inline-block" />
                        </div>
                      </template>
                    </CopyToClipboard>
                  </div>
                  <ul class="relative flex flex-col items-center whitespace-nowrap w-full mb-4">
                    <li class="flex flex-row items-center justify-between w-full border-t border-gray-600/20 py-2">
                      <div>{{ numeral(wallets.miningWallet.availableMicrogons).format('0,0.[00]') }} ARGNs</div>
                      <div>
                        {{ currency.symbol
                        }}{{ microgonToMoneyNm(wallets.miningWallet.availableMicrogons).format('0,0.00') }}
                      </div>
                    </li>
                    <li class="flex flex-row items-center justify-between w-full border-t border-gray-600/20 py-2">
                      <div>{{ numeral(wallets.miningWallet.availableMicronots).format('0,0.[00]') }} ARGNOTs</div>
                      <div>
                        {{ currency.symbol
                        }}{{ micronotToMoneyNm(wallets.miningWallet.availableMicronots).format('0,0.00') }}
                      </div>
                    </li>
                    <li class="flex flex-row items-center justify-between w-full border-t border-gray-600/20 py-2">
                      <div>{{ numeral(wallets.miningWallet.reservedMicronots).format('0,0.[00]') }} Locked ARGNOTs</div>
                      <div>
                        {{ currency.symbol
                        }}{{ micronotToMoneyNm(wallets.miningWallet.reservedMicronots).format('0,0.00') }}
                      </div>
                    </li>
                    <li class="flex flex-row items-center justify-between w-full border-t border-gray-600/20 py-2">
                      <div>{{ numeral(stats.myMiningBids.bidCount).format('0,0') }} Mining Bids</div>
                      <div>
                        {{ currency.symbol
                        }}{{ microgonToMoneyNm(wallets.miningBidValue).format('0,0.00') }}
                      </div>
                    </li>
                    <li class="flex flex-row items-center justify-between w-full border-t border-gray-600/20 py-2">
                      <div>{{ numeral(stats.myMiningSeats.seatCount).format('0,0') }} Mining Seats</div>
                      <div>
                        {{ currency.symbol
                        }}{{ microgonToMoneyNm(wallets.miningSeatValue).format('0,0.00') }}
                      </div>
                    </li>
                  </ul>
                </section>

                <div class="bg-slate-400/30 w-[1px] h-full mx-1"></div>

                <section
                  @click="() => openWalletOverlay('vaulting', close)"
                  class="relative flex flex-col items-center w-80 pt-7 px-6 hover:bg-argon-menu-hover/70 cursor-pointer"
                >
                  <header class="text-lg font-bold text-gray-900">Vaulting Resources</header>
                  <div class="relative">
                    <VaultingWalletIcon class="w-12 h-12 mt-5" />
                  </div>
                  <span class="text-4xl font-bold mt-5">
                    <span>
                      {{ currency.symbol }}{{ microgonToMoneyNm(vaultingWalletTotalValue).format('0,0.00').split('.')[0] }}
                    </span>
                    <span class="opacity-50">
                      .{{ microgonToMoneyNm(vaultingWalletTotalValue).format('0.00').split('.')[1] }}
                    </span>
                  </span>
                  <div class="relative text-sm text-gray-500 flex flex-row w-full justify-center pb-8">
                    <CopyToClipboard
                      @click.stop
                      :content="wallets.vaultingWallet.address"
                      class="flex flex-row relative items-center justify-center hover:bg-white rounded-full px-6 py-1 cursor-pointer"
                    >
                      {{ abreviateAddress(wallets.vaultingWallet.address) }}
                      <CopyIcon class="w-3 h-3 ml-1 inline-block" />
                      <template #copied>
                        <div
                          class="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-row items-center justify-center"
                        >
                          {{ abreviateAddress(wallets.vaultingWallet.address) }}
                          <CopyIcon class="w-3 h-3 ml-1 inline-block" />
                        </div>
                      </template>
                    </CopyToClipboard>
                  </div>
                  <ul class="relative flex flex-col items-center whitespace-nowrap w-full mb-4">
                    <li class="flex flex-row items-center justify-between w-full border-t border-gray-600/20 py-2">
                      <div>{{ numeral(wallets.vaultingWallet.availableMicrogons).format('0,0.[00]') }} ARGNs</div>
                      <div>
                        {{ currency.symbol
                        }}{{ microgonToMoneyNm(wallets.vaultingWallet.availableMicrogons).format('0,0.00') }}
                      </div>
                    </li>
                    <li class="flex flex-row items-center justify-between w-full border-t border-gray-600/20 py-2">
                      <div>{{ numeral(wallets.vaultingWallet.availableMicronots).format('0,0.[00]') }} ARGNOTs</div>
                      <div>
                        {{ currency.symbol
                        }}{{ micronotToMoneyNm(wallets.vaultingWallet.availableMicronots).format('0,0.00') }}
                      </div>
                    </li>
                    <li
                      class="flex flex-row items-center justify-between w-full border-t border-b border-gray-600/20 py-2"
                    >
                      <div>{{ numeral(wallets.vaultingWallet.availableMicrogons).format('0,0.[00]') }} Vaulted ARGNs</div>
                      <div>
                        {{ currency.symbol
                        }}{{ microgonToMoneyNm(wallets.vaultingWallet.availableMicrogons).format('0,0.00') }}
                      </div>
                    </li>
                  </ul>
                </section>
              </div>
            </PopoverPanel>
          </transition>
        </Popover>
      </div>
      <div v-else class="text-gray-900 px-2">Loading...</div>

      <div class="bg-slate-400/50 w-[1px] h-[28px]"></div>

      <Popover class="relative pointer-events-auto" v-slot="{ open: isOpen }">
        <PopoverButton
          class="flex items-center justify-center text-sm/6 font-semibold text-gray-900 cursor-pointer border rounded-md w-[38px] h-[30px] focus:outline-none hover:border-slate-400/50"
          :class="[isOpen ? 'border-slate-400/50' : 'border-transparent']"
        >
          <ConfigIcon class="w-5 h-5" />
        </PopoverButton>

        <transition
          enter-active-class="transition ease-out duration-200"
          enter-from-class="opacity-0 translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition ease-in duration-150"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-1"
        >
          <PopoverPanel v-slot="{ close }" class="absolute -right-3 z-[1000] mt-2 flex w-screen max-w-min">
            <div class="absolute -top-[15px] right-3 w-[30px] h-[15px] overflow-hidden">
              <div
                class="relative top-[5px] left-[5px] w-[20px] h-[20px] rotate-45 bg-slate-50 ring-1 ring-gray-900/20"
              ></div>
            </div>
            <div
              class="flex flex-col shrink rounded bg-argon-menu-bg text-sm/6 font-semibold text-gray-900 shadow-lg ring-1 ring-gray-900/20"
            >
              <ul AccountMenu>
                <li @click="() => openBotOverlay(close)" class="pt-3 pb-3">
                  <header v-if="!config.hasSavedBiddingRules">Create Personal Mining Bot</header>
                  <header v-else>Update Personal Mining Bot</header>
                  <p>
                    Set lock fees and securitization
                    <br />
                    parameters for a new bitcoin vault
                  </p>
                </li>
                <li divider class="bg-slate-400/30 h-[1px] w-full my-1"></li>
                <li @click="() => openConfigureStabilizationVaultOverlay(close)" class="pt-2 pb-3">
                  <header v-if="!config.hasSavedVaultingRules">Create Stabilization Vault</header>
                  <header v-else>Configure Stabilization Vault Settings</header>
                  <p>
                    Set securitization ratios, profit sharing,
                    <br />
                    and other parameters for your vault.
                  </p>
                </li>
                <li divider class="bg-slate-400/30 h-[1px] w-full my-1"></li>
                <li @click="() => openSecuritySettingsOverlay(close)" class="py-2">
                  <header>Security Settings</header>
                </li>
                <li divider class="bg-slate-400/30 h-[1px] w-full my-1"></li>
                <li @click="() => openComplianceOverlay(close)" class="py-2">
                  <header>Jurisdictional Compliance</header>
                </li>
                <li divider class="bg-slate-400/30 h-[1px] w-full my-1"></li>
                <li @click="() => openAboutOverlay(close)" class="py-2">
                  <header>About Commander</header>
                </li>
                <!-- <li class="py-2">
                  <header>How to Live Forever</header>
                </li> -->
              </ul>
            </div>
          </PopoverPanel>
        </transition>
      </Popover>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useController } from '../stores/controller';
import { useConfig, NETWORK_NAME } from '../stores/config';
import { useWallets } from '../stores/wallets';
import { useCurrency } from '../stores/currency';
import { useStats } from '../stores/stats';
import WindowControls from '../tauri-controls/WindowControls.vue';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
import { abreviateAddress } from '../lib/Utils';
import basicEmitter from '../emitters/basicEmitter';
import CurrencyMenu from './CurrencyMenu.vue';
import MiningWalletIcon from '../assets/wallets/mining.svg?component';
import VaultingWalletIcon from '../assets/wallets/vault.svg?component';
import CopyIcon from '../assets/copy.svg?component';
import ConfigIcon from '../assets/config.svg?component';
import CopyToClipboard from './CopyToClipboard.vue';
import numeral, { createNumeralHelpers } from '../lib/numeral';
import { INSTANCE_NAME } from '../lib/Config';

const controller = useController();
const config = useConfig();
const wallets = useWallets();
const currency = useCurrency();
const stats = useStats();
const { microgonToMoneyNm, micronotToMoneyNm } = createNumeralHelpers(currency);

const currencyMenuIsOpen = Vue.ref(false);
const walletControlPopoverIsOpen = Vue.ref(false);
const walletControlPopoverElem = Vue.ref<{ el: HTMLElement | null }>({ el: null });

const vaultingWalletTotalValue = Vue.computed(() => {
  return (
    wallets.vaultingWallet.availableMicrogons + currency.micronotToMicrogon(wallets.vaultingWallet.availableMicronots)
  );
});

function openWalletOverlay(walletId: 'mining' | 'vaulting', closeFn: () => void) {
  basicEmitter.emit('openWalletOverlay', { walletId, screen: 'main' });
  if (closeFn) {
    closeFn();
  }
}

function openConfigureStabilizationVaultOverlay(close: () => void) {
  basicEmitter.emit('openConfigureStabilizationVaultOverlay');
  if (close) {
    close();
  }
}

function openBotOverlay(close: () => void) {
  basicEmitter.emit('openBotOverlay');
  if (close) {
    close();
  }
}

function openSecuritySettingsOverlay(close: () => void) {
  basicEmitter.emit('openSecuritySettingsOverlay');
  if (close) {
    close();
  }
}

function openAboutOverlay(close: () => void) {
  basicEmitter.emit('openAboutOverlay');
  if (close) {
    close();
  }
}

function openComplianceOverlay(close: () => void) {
  basicEmitter.emit('openComplianceOverlay');
  if (close) {
    close();
  }
}

Vue.watch(
  () => walletControlPopoverElem.value?.el,
  el => (walletControlPopoverIsOpen.value = !!el),
);
</script>

<style scoped>
@reference "../main.css";

ul.TOGGLE {
  position: relative;
  box-shadow: inset 1px 1px 2px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
  &[disabled='true'] {
    pointer-events: none;
  }
  &[isRunning='true'] li {
    opacity: 0.5 !important;
  }
  li {
    z-index: 1;
    cursor: pointer;
    padding: 4px 30px;
    transition: opacity 0.3s ease;
    position: relative;
    span {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
      z-index: 2;
    }
  }
  li.selected {
    color: #99009d;
  }
  li.selected:after {
    content: '';
    width: calc(100% + 2px);
    height: calc(100% + 2px);
    position: absolute;
    top: -1px;
    left: -1px;
    background: white;
    border-radius: 5px;
    border: 1px solid #979797;
    box-shadow: 0 1px rgba(0, 0, 0, 0.1);
    cursor: default;
    transition: left 0.3s ease;
    z-index: 1;
  }
  li:not(.selected) {
    opacity: 0.3;
  }
  li:last-child.selected:after {
    left: -1px;
  }
}

ul[AccountMenu] {
  @apply p-1;
  list-style-type: none;
  li {
    @apply px-4 hover:!text-indigo-600 hover:bg-argon-menu-hover cursor-pointer;
    header {
      @apply font-bold text-gray-900 whitespace-nowrap text-right;
    }
    p {
      @apply text-gray-700 whitespace-nowrap text-right font-light;
      line-height: 1.4em;
    }
  }
}
</style>
