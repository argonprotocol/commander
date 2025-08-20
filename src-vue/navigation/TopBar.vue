<!-- prettier-ignore -->
<template>
  <div
    class="bg-white/95 min-h-14 w-full flex flex-row items-center select-none"
    style="border-radius: 10px 10px 0 0; box-shadow: 0 2px 2px rgba(0, 0, 0, 0.2)"
    data-tauri-drag-region
  >
    <div class="flex flex-row items-center w-1/2 pointer-events-none">
      <WindowControls />
      <div class="text-xl font-bold whitespace-nowrap">
        Argon Commander
        <span class="font-light text-lg">({{ NETWORK_NAME }}<template v-if="INSTANCE_NAME !== 'default'">, {{ INSTANCE_NAME?.slice(0, 5) }}<template v-if="INSTANCE_NAME.length > 5">...</template></template>)</span>
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

    <div v-if="controller.isLoaded"
      class="flex flex-row mr-3 space-x-2 items-center justify-end w-1/2 pointer-events-none relative top-[1px]"
      :class="[wallets.isLoaded ? '' : 'opacity-20']"
    >
      <div :class="[controller.panel === 'mining' && bot.isSyncing ? 'pointer-events-none' : 'pointer-events-auto']"><StatusMenu /></div>
      <div :class="[controller.panel === 'mining' && bot.isSyncing ? 'pointer-events-none' : 'pointer-events-auto']"><CurrencyMenu /></div>
      <div :class="[controller.panel === 'mining' && bot.isSyncing ? 'pointer-events-none' : 'pointer-events-auto']"><AccountMenu /></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useController } from '../stores/controller';
import WindowControls from '../tauri-controls/WindowControls.vue';
import CurrencyMenu from './CurrencyMenu.vue';
import { INSTANCE_NAME, NETWORK_NAME } from '../lib/Env.ts';
import StatusMenu from './StatusMenu.vue';
import AccountMenu from './AccountMenu.vue';
import { useWallets } from '../stores/wallets';
import { useBot } from '../stores/bot';

const controller = useController();
const wallets = useWallets();
const bot = useBot();
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
</style>
