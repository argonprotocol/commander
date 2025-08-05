<template>
  <div @mouseenter="onMouseEnter" @mouseleave="onMouseLeave">
    <DropdownMenuRoot :openDelay="0" :closeDelay="0" class="relative pointer-events-auto" v-model:open="isOpen">
      <DropdownMenuTrigger
        @click="onToggle"
        class="flex flex-row items-center justify-center text-sm/6 font-semibold text-gray-900 cursor-pointer border rounded-md w-[38px] h-[30px] hover:bg-slate-400/10 focus:outline-none hover:border-slate-400/50"
        :class="[isOpen ? 'border-slate-400/50' : 'border-transparent']"
      >
        <ConfigIcon class="w-5 h-5" />
      </DropdownMenuTrigger>

      <DropdownMenuPortal>
        <DropdownMenuContent
          @mouseenter="onMouseEnter"
          @mouseleave="onMouseLeave"
          :align="'end'"
          :alignOffset="0"
          :sideOffset="-3"
          class="data-[side=bottom]:animate-slideUpAndFade data-[side=right]:animate-slideLeftAndFade data-[side=left]:animate-slideRightAndFade data-[side=top]:animate-slideDownAndFad data-[state=open]:transition-all"
        >
          <div
            class="flex flex-col shrink p-1 rounded bg-argon-menu-bg text-sm/6 font-semibold text-gray-900 shadow-lg ring-1 ring-gray-900/20"
          >
            <DropdownMenuItem @click="() => openBotOverlay()" class="pt-3 pb-3">
              <header v-if="!config.hasSavedBiddingRules">Create Personal Mining Bot</header>
              <header v-else>Configure Personal Mining Bot</header>
              <p>
                Set lock fees and securitization
                <br />
                parameters for a new bitcoin vault
              </p>
            </DropdownMenuItem>
            <DropdownMenuSeparator divider class="bg-slate-400/30 h-[1px] w-full my-1" />
            <DropdownMenuItem @click="() => openConfigureStabilizationVaultOverlay()" class="pt-2 pb-3">
              <header v-if="!config.hasSavedVaultingRules">Create Stabilization Vault</header>
              <header v-else>Configure Stabilization Vault Settings</header>
              <p>
                Set securitization ratios, profit sharing,
                <br />
                and other parameters for your vault.
              </p>
            </DropdownMenuItem>
            <DropdownMenuSeparator divider class="bg-slate-400/30 h-[1px] w-full my-1" />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger class="py-2 relative">
                <ChevronLeftIcon class="w-5 h-5 absolute left-0.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <header>Transfer Tokens</header>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent class="min-w-50 relative -top-1">
                <div
                  class="flex flex-col shrink rounded p-1 bg-argon-menu-bg text-sm/6 font-semibold text-gray-900 shadow-lg ring-1 ring-gray-900/20"
                >
                  <DropdownMenuItem class="py-2" @click="() => openFundMiningAccountOverlay()">
                    <header>Into Mining Account</header>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator divider class="bg-slate-400/30 h-[1px] w-full my-1" />
                  <DropdownMenuItem class="py-2" @click="() => openFundVaultingAccountOverlay()">
                    <header>Into Vaulting Account</header>
                  </DropdownMenuItem>
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator divider class="bg-slate-400/30 h-[1px] w-full my-1" />
            <DropdownMenuItem @click="() => openSecuritySettingsOverlay()" class="py-2">
              <header>Security Settings</header>
            </DropdownMenuItem>
            <DropdownMenuSeparator divider class="bg-slate-400/30 h-[1px] w-full my-1" />
            <DropdownMenuItem @click="() => openComplianceOverlay()" class="py-2">
              <header>Jurisdictional Compliance</header>
            </DropdownMenuItem>
            <DropdownMenuSeparator divider class="bg-slate-400/30 h-[1px] w-full my-1" />
            <DropdownMenuItem @click="() => openAboutOverlay()" class="py-2">
              <header>About Commander</header>
            </DropdownMenuItem>
            <!-- <DropdownMenuItem class="py-2">
              <header>How to Live Forever</header>
            </DropdownMenuItem> -->
          </div>
          <DropdownMenuArrow :width="18" :height="10" class="fill-white stroke-gray-300 mt-[0px]" />
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import {
  DropdownMenuArrow,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui';
import ConfigIcon from '../assets/config.svg?component';
import basicEmitter from '../emitters/basicEmitter';
import { useConfig } from '../stores/config';
import { ChevronLeftIcon } from '@heroicons/vue/24/outline';

const config = useConfig();
const isOpen = Vue.ref(false);

let mouseLeaveTimerId: ReturnType<typeof setTimeout> | null = null;

function onMouseEnter() {
  if (mouseLeaveTimerId) {
    clearTimeout(mouseLeaveTimerId);
  }
  mouseLeaveTimerId = null;
  isOpen.value = true;
}

function onMouseLeave() {
  if (mouseLeaveTimerId) {
    clearTimeout(mouseLeaveTimerId);
  }
  mouseLeaveTimerId = setTimeout(() => {
    isOpen.value = false;
  }, 100);
}

function onToggle() {
  console.log('onToggle');
}

function openConfigureStabilizationVaultOverlay() {
  basicEmitter.emit('openConfigureStabilizationVaultOverlay');
  isOpen.value = false;
}

function openBotOverlay() {
  basicEmitter.emit('openBotOverlay');
  isOpen.value = false;
}

function openSecuritySettingsOverlay() {
  basicEmitter.emit('openSecuritySettingsOverlay');
  isOpen.value = false;
}

function openAboutOverlay() {
  basicEmitter.emit('openAboutOverlay');
  isOpen.value = false;
}

function openComplianceOverlay() {
  basicEmitter.emit('openComplianceOverlay');
  isOpen.value = false;
}

function openFundMiningAccountOverlay() {
  basicEmitter.emit('openWalletOverlay', { walletId: 'mining', screen: 'receive' });
}

function openFundVaultingAccountOverlay() {
  basicEmitter.emit('openWalletOverlay', { walletId: 'vaulting', screen: 'receive' });
}
</script>

<style scoped>
@reference "../main.css";

[data-reka-collection-item] {
  @apply px-4 focus:!text-indigo-600 focus:bg-argon-menu-hover cursor-pointer focus:outline-none;
  header {
    @apply font-bold text-gray-900 whitespace-nowrap text-right;
  }
  p {
    @apply text-gray-700 whitespace-nowrap text-right font-light;
    line-height: 1.4em;
  }
}
</style>
