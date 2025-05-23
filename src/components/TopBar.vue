<template>
  <div class="bg-white/95 min-h-14 w-full flex flex-row items-center select-none" style="border-radius: 10px 10px 0 0; box-shadow: 0 2px 2px rgba(0, 0, 0, 0.2)" data-tauri-drag-region>
    <div class="flex flex-row items-center w-1/2 pointer-events-none">
      <WindowControls />
      <div class="text-xl font-bold">Argon Commander <span class="font-light">(beta)</span></div>
    </div>
    
    <div class="flex-grow flex justify-center pointer-events-none">
      <ul class="TOGGLE flex flex-row fit-content bg-[#E9EBF1] border border-[#b8b9bd] rounded text-center text-slate-600 pointer-events-auto">
        <li class="border-r border-slate-400" @click="basicStore.setPanel('mining')" :class="{ 'selected': basicStore.panel === 'mining' }">
          <span class="px-2">Mining</span>
        </li>
        <li class="border-r border-slate-400" @click="basicStore.setPanel('liquid-locking')" :class="{ 'selected': basicStore.panel === 'liquid-locking' }">
          <span>Liquid Locking</span>
        </li>
        <li @click="basicStore.setPanel('vaulting')" :class="{ 'selected': basicStore.panel === 'vaulting' }">
          <span>Vaulting</span>
        </li>
      </ul>
    </div>
    
    <div class="flex flex-row mr-1 space-x-1 items-center justify-end w-1/2 pointer-events-none">
      <div :class="walletControlPopoverIsOpen || currencyMenuIsOpen ? 'border-slate-400/50' : 'border-transparent'" class="flex flex-row items-center border hover:border-slate-400/50 rounded-md group">
        <CurrencyMenu @currencyMenuIsOpen="x => currencyMenuIsOpen = x" />

        <div class="bg-slate-400/50 w-[1px] h-[28px]"></div>

        <Popover v-if="configStore.isLoaded" class="relative pointer-events-auto">
          <PopoverButton class="relative flex flex-row text-xl font-bold text-[#B74CBA] pt-[1px] pl-[14px] pr-[10px] mr-[0px] h-[30px] items-center hover:bg-slate-400/10 cursor-pointer focus-visible:outline-none">
            {{ addCommas(argonTo(configStore.totalWalletValue), 2) }}
            <AlertIcon v-if="!mngWalletIsFullyFunded" class="absolute -top-0 right-[-6px] w-3 h-3 text-[#B74CBA] mr-[7px] inline-block shadow-md" />
          </PopoverButton>
          <transition enter-active-class="transition ease-out duration-200" enter-from-class="opacity-0 translate-y-1" enter-to-class="opacity-100 translate-y-0" leave-active-class="transition ease-in duration-150" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 translate-y-1">
            <PopoverPanel ref="walletControlPopoverElem" v-slot="{ close: closeFn }" class="absolute -right-2 z-[1000] mt-2 flex w-screen max-w-min">
              <div class="absolute -top-[15px] right-[20px] w-[30px] h-[15px] overflow-hidden">
                <div class="relative top-[5px] left-[5px] w-[20px] h-[20px] rotate-45 bg-white ring-1 ring-gray-900/20"></div>
              </div>
              <div class="flex flex-row shrink rounded bg-white text-sm/6 font-semibold text-gray-900 shadow-lg py-1 px-1 ring-1 ring-gray-900/20">
                
                <section @click="openWalletOverlay('mng', closeFn)" class="relative flex flex-col items-center w-60 pt-7 px-6 hover:bg-argon-menu-hover/70 cursor-pointer">
                  <header class="text-lg font-bold text-gray-900">Mining Wallet</header>
                  <div class="relative">
                    <MiningWalletIcon class="w-12 h-12 mt-5" />
                    <AlertIcon v-if="!mngWalletIsFullyFunded" class="text-argon-button absolute top-7 -left-1 w-4 h-4" />
                  </div>
                  <span class="text-4xl font-bold mt-5">{{currencySymbol}}{{ addCommas(argonTo(mngWallet.totalValue), 2).split('.')[0] }}<span class="opacity-50">.{{ argonTo(mngWallet.totalValue).toFixed(2).split('.')[1] }}</span></span>
                  
                  <span class="relative text-sm text-gray-500 flex flex-row">
                    <CopyToClipboard @click.stop :content="configStore.mngWallet.address" class="flex flex-row relative items-center justify-center hover:bg-white rounded-full px-6 py-1 cursor-pointer">
                      {{abreviateAddress(configStore.mngWallet.address)}} <CopyIcon class="w-3 h-3 ml-1 inline-block" />
                      <template #copied>
                        <div class="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-row items-center justify-center">
                          {{abreviateAddress(configStore.mngWallet.address)}} <CopyIcon class="w-3 h-3 ml-1 inline-block" />
                        </div>
                      </template>
                    </CopyToClipboard>
                    <div v-if="!mngWalletIsFullyFunded" @click.stop="openFundMiningWalletOverlay(closeFn)" class="absolute flex flex-row top-1 left-1/2 -translate-x-1/2 border border-fuchsia-950 shadow-md items-center justify-center whitespace-nowrap uppercase text-white bg-argon-button hover:bg-argon-button-hover rounded px-5 w-48 text-center py-1 text-sm">
                      <AlertIcon class="w-4 h-4 text-white mr-2 inline-block" />
                      <span class="relative top-[0.4px]">Funds Are Low</span>
                    </div>
                  </span>
                  <ul class="relative flex flex-col items-center whitespace-nowrap w-full mt-4 mb-4">
                    <li class="flex flex-row items-center justify-between w-full border-t border-gray-600/20 py-2">
                      <div>{{ addCommas(mngWallet.argons, 2) }} ARGN</div>
                      <div>{{currencySymbol}}{{addCommas(argonTo(mngWallet.argons), 2)}}</div>
                    </li>
                    <li class="flex flex-row items-center justify-between w-full border-t border-gray-600/20 py-2">
                      <div>{{ addCommas(mngWallet.argonots, 2) }} ARGNOT</div>
                      <div>{{currencySymbol}}{{addCommas(argonotTo(mngWallet.argonots), 2)}}</div>
                    </li>                    
                  </ul>
                </section>

                <div class="bg-slate-400/30 w-[1px] h-full mx-1"></div>
                
                <section @click="openWalletOverlay('llb', closeFn)" class="relative flex flex-col items-center w-60 pt-7 px-6 hover:bg-argon-menu-hover/70 cursor-pointer">
                  <header class="text-lg font-bold text-gray-900">Liquid Locking Wallet</header>
                  <div class="relative">
                    <LiquidLockingWalletIcon class="w-12 h-12 mt-5" />
                  </div>
                  <span class="text-4xl font-bold mt-5">{{currencySymbol}}{{ addCommas(argonTo(llbWallet.totalValue), 2).split('.')[0] }}<span class="opacity-50">.{{ argonTo(llbWallet.totalValue).toFixed(2).split('.')[1] }}</span></span>
                  <span class="relative text-sm text-gray-500 flex flex-row">
                    <CopyToClipboard @click.stop :content="configStore.llbWallet.address" class="flex flex-row relative items-center justify-center hover:bg-white rounded-full px-6 py-1 cursor-pointer">
                      {{abreviateAddress(configStore.llbWallet.address)}} <CopyIcon class="w-3 h-3 ml-1 inline-block" />
                      <template #copied>
                        <div class="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-row items-center justify-center">
                          {{abreviateAddress(configStore.llbWallet.address)}} <CopyIcon class="w-3 h-3 ml-1 inline-block" />
                        </div>
                      </template>
                    </CopyToClipboard>
                  </span>
                  <ul class="flex flex-col items-center whitespace-nowrap w-full mt-4 mb-4">
                    <li class="flex flex-row items-center justify-between w-full border-t border-gray-600/20 py-2">
                      <div>{{ addCommas(llbWallet.argons, 2) }} ARGN</div>
                      <div>{{currencySymbol}}{{addCommas(argonTo(llbWallet.argons), 2)}}</div>
                    </li>
                    <li class="flex flex-row items-center justify-between w-full border-t border-gray-600/20 py-2">
                      <div>{{ addCommas(llbWallet.argonots, 2) }} ARGNOT</div>
                      <div>{{currencySymbol}}{{addCommas(argonotTo(llbWallet.argonots), 2)}}</div>
                    </li>                    
                  </ul>
                </section>
                
                <div class="bg-slate-400/30 w-[1px] h-full mx-1"></div>

                <section @click="openWalletOverlay('vlt', closeFn)" class="relative flex flex-col items-center w-60 pt-7 px-6 hover:bg-argon-menu-hover/70 cursor-pointer">
                  <header class="text-lg font-bold text-gray-900">Vaulting Wallet</header>
                  <div class="relative">
                    <VaultingWalletIcon class="w-12 h-12 mt-5" />
                  </div>
                  <span class="text-4xl font-bold mt-5">{{currencySymbol}}{{ addCommas(argonTo(vltWallet.totalValue), 2).split('.')[0] }}<span class="opacity-50">.{{ argonTo(vltWallet.totalValue).toFixed(2).split('.')[1] }}</span></span>
                  <span class="relative text-sm text-gray-500 flex flex-row">
                    <CopyToClipboard @click.stop :content="configStore.vltWallet.address" class="flex flex-row relative items-center justify-center hover:bg-white rounded-full px-6 py-1 cursor-pointer">
                      {{abreviateAddress(configStore.vltWallet.address)}} <CopyIcon class="w-3 h-3 ml-1 inline-block" />
                      <template #copied>
                        <div class="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-row items-center justify-center">
                          {{abreviateAddress(configStore.vltWallet.address)}} <CopyIcon class="w-3 h-3 ml-1 inline-block" />
                        </div>
                      </template>
                    </CopyToClipboard>
                  </span>
                  <ul class="flex flex-col items-center whitespace-nowrap w-full mt-4 mb-4">
                    <li class="flex flex-row items-center justify-between w-full border-t border-gray-600/20 py-2">
                      <div>{{ addCommas(vltWallet.argons, 2) }} ARGN</div>
                      <div>{{currencySymbol}}{{addCommas(argonTo(vltWallet.argons), 2)}}</div>
                    </li>
                    <li class="flex flex-row items-center justify-between w-full border-t border-gray-600/20 py-2">
                      <div>{{ addCommas(vltWallet.argonots, 2) }} ARGNOT</div>
                      <div>{{currencySymbol}}{{addCommas(argonotTo(vltWallet.argonots), 2)}}</div>
                    </li>                    
                  </ul>
                </section>
              </div>
            </PopoverPanel>
          </transition>
        </Popover>
        <div v-else class="text-gray-900">
            Loading...
        </div>
      </div>

      <div class="bg-slate-400/50 w-[1px] h-[28px]"></div>
      
      <Popover class="relative pointer-events-auto" v-slot="{ open: isOpen }">
        <PopoverButton class="flex items-center justify-center text-sm/6 font-semibold text-gray-900 cursor-pointer border rounded-md w-[38px] h-[30px] focus:outline-none hover:border-slate-400/50" :class="[ isOpen ? 'border-slate-400/50' : 'border-transparent' ]">
          <ConfigIcon class="w-5 h-5" />
        </PopoverButton>

        <transition enter-active-class="transition ease-out duration-200" enter-from-class="opacity-0 translate-y-1" enter-to-class="opacity-100 translate-y-0" leave-active-class="transition ease-in duration-150" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 translate-y-1">
          <PopoverPanel v-slot="{ close }" class="absolute -right-3 z-[1000] mt-2 flex w-screen max-w-min">
            <div class="absolute -top-[15px] right-3 w-[30px] h-[15px] overflow-hidden">
              <div class="relative top-[5px] left-[5px] w-[20px] h-[20px] rotate-45 bg-slate-50 ring-1 ring-gray-900/20"></div>
            </div>
            <div class="flex flex-col shrink rounded bg-argon-menu-bg text-sm/6 font-semibold text-gray-900 shadow-lg ring-1 ring-gray-900/20">
              <ul AccountMenu>
                <li v-if="serverConnection.isConnected" @click="openServerConfigureOverlay(close)" class="pt-3 pb-2" >
                  <header>Configure Cloud Machine</header>
                  <p>
                    Configure and manage the cloud server<br />that runs your Argon mining operations
                  </p>
                </li>
                <li v-else class="pt-3 pb-2" @click="openServerConnectOverlay(close)">
                  <header>Connect Cloud Machine</header>
                  <p>
                    Connect a new cloud server to<br />run your Argon mining operations
                  </p>
                </li>
                <li @click="openBiddingRulesOverlay(close)" class="pt-2 pb-3">
                  <header>Configure Bidding Rules</header>
                  <p>Set bid pricing and other required<br />parameters for upcoming mining auctions</p>
                </li>
                <li class="bg-slate-400/30 h-[1px] w-full my-1"></li>
                <li @click="openSecuritySettingsOverlay(close)" class="py-2">
                  <header>Security Settings</header>
                </li>
                <li class="bg-slate-400/30 h-[1px] w-full my-1"></li>
                <li class="py-2">
                  <header>How to Live Forever</header>
                </li>
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
import { useBasicStore } from '../stores/basic';
import { useConfigStore } from '../stores/config';
import WindowControls from "../tauri-controls/WindowControls.vue";
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
import { addCommas, abreviateAddress } from '../lib/Utils';
import emitter from '../emitters/basic';
import CurrencyMenu from './CurrencyMenu.vue';
import MiningWalletIcon from '../assets/wallets/mining.svg';
import LiquidLockingWalletIcon from '../assets/wallets/bitcoin.svg';
import VaultingWalletIcon from '../assets/wallets/vault.svg';
import CopyIcon from '../assets/copy.svg';
import ConfigIcon from '../assets/config.svg';
import AlertIcon from '../assets/alert.svg';
import CopyToClipboard from './CopyToClipboard.vue';
import { storeToRefs } from 'pinia';

const basicStore = useBasicStore();
const configStore = useConfigStore();
const { serverConnection, mngWallet, llbWallet, vltWallet, currencySymbol } = storeToRefs(configStore);
const { argonotTo, argonTo } = configStore;

const currencyMenuIsOpen = Vue.ref(false);
const walletControlPopoverIsOpen = Vue.ref(false);
const walletControlPopoverElem = Vue.ref<{ el: HTMLElement | null }>({ el: null });

const mngWalletIsFullyFunded = Vue.computed(() => { 
  if (!configStore.biddingRules) return false;
  return (configStore.mngWallet.argons >= configStore.biddingRules.desiredArgons && configStore.mngWallet.argonots >= configStore.biddingRules.desiredArgonots);
});

const openWalletOverlay = (walletId: 'mng' | 'llb' | 'vlt', closeFn: () => void) => {
  emitter.emit('openWalletOverlay', { walletId, screen: 'main' });
  if (closeFn) {
    closeFn();
  }
}

const openFundMiningWalletOverlay = (close: () => void) => {
  emitter.emit('openWalletOverlay', { walletId: 'mng', screen: 'receive' });
  if (close) {
    close();
  }
}

const openServerConnectOverlay = (close: () => void) => {
  emitter.emit('openServerConnectOverlay');
  if (close) {
    close();
  }
}

const openServerConfigureOverlay = (close: () => void) => {
  emitter.emit('openServerConfigureOverlay');
  if (close) {
    close();
  }
}

const openBiddingRulesOverlay = (close: () => void) => {
  emitter.emit('openBiddingRulesOverlay');
  if (close) {
    close();
  }
}

const openSecuritySettingsOverlay = (close: () => void) => {
  emitter.emit('openSecuritySettingsOverlay');
  if (close) {
    close();
  }
}

Vue.watch(() => walletControlPopoverElem.value?.el, (el) => walletControlPopoverIsOpen.value = !!el);
</script>

<style scoped>
@reference "../main.css";

ul.TOGGLE {
  position: relative;
  box-shadow: inset 1px 1px 2px rgba(0,0,0,0.2);
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
    padding: 4px 16px;
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
    color: #99009D;
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
    box-shadow: 0 1px rgba(0,0,0,0.1);
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