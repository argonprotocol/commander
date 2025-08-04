<template>
  <HoverCardRoot :openDelay="0" :closeDelay="0" class="relative pointer-events-auto" v-model:open="isOpen">
    <HoverCardTrigger
      class="flex items-center justify-center text-sm/6 font-semibold text-gray-900 cursor-pointer border rounded-md w-[38px] h-[30px] focus:outline-none hover:border-slate-400/50"
      :class="[isOpen ? 'border-slate-400/50' : 'border-transparent']"
    >
      <ConfigIcon class="w-5 h-5" />
    </HoverCardTrigger>

    <HoverCardPortal>
      <HoverCardContent
        :align="'end'"
        :alignOffset="0"
        :sideOffset="0"
        class="data-[side=bottom]:animate-slideUpAndFade data-[side=right]:animate-slideLeftAndFade data-[side=left]:animate-slideRightAndFade data-[side=top]:animate-slideDownAndFad data-[state=open]:transition-all"
      >
        <div
          class="flex flex-col shrink rounded bg-argon-menu-bg text-sm/6 font-semibold text-gray-900 shadow-lg ring-1 ring-gray-900/20"
        >
          <ul AccountMenu>
            <li @click="() => openBotOverlay()" class="pt-3 pb-3">
              <header v-if="!config.hasSavedBiddingRules">Create Personal Mining Bot</header>
              <header v-else>Configure Personal Mining Bot</header>
              <p>
                Set lock fees and securitization
                <br />
                parameters for a new bitcoin vault
              </p>
            </li>
            <li divider class="bg-slate-400/30 h-[1px] w-full my-1"></li>
            <li @click="() => openConfigureStabilizationVaultOverlay()" class="pt-2 pb-3">
              <header v-if="!config.hasSavedVaultingRules">Create Stabilization Vault</header>
              <header v-else>Configure Stabilization Vault Settings</header>
              <p>
                Set securitization ratios, profit sharing,
                <br />
                and other parameters for your vault.
              </p>
            </li>
            <li divider class="bg-slate-400/30 h-[1px] w-full my-1"></li>
            <li @click="() => openSecuritySettingsOverlay()" class="py-2">
              <header>Security Settings</header>
            </li>
            <li divider class="bg-slate-400/30 h-[1px] w-full my-1"></li>
            <li @click="() => openComplianceOverlay()" class="py-2">
              <header>Jurisdictional Compliance</header>
            </li>
            <li divider class="bg-slate-400/30 h-[1px] w-full my-1"></li>
            <li @click="() => openAboutOverlay()" class="py-2">
              <header>About Commander</header>
            </li>
            <!-- <li class="py-2">
              <header>How to Live Forever</header>
            </li> -->
          </ul>
        </div>
        <HoverCardArrow :width="18" :height="10" class="fill-white stroke-gray-300 mt-[0px]" />
      </HoverCardContent>
    </HoverCardPortal>
  </HoverCardRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { HoverCardArrow, HoverCardContent, HoverCardPortal, HoverCardRoot, HoverCardTrigger } from 'reka-ui';
import ConfigIcon from '../assets/config.svg?component';
import basicEmitter from '../emitters/basicEmitter';
import { useConfig } from '../stores/config';

const config = useConfig();
const isOpen = Vue.ref(false);

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
</script>

<style scoped>
@reference "../main.css";

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
