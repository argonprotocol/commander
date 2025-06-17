<template>
  <TransitionRoot class="absolute inset-0 z-10" :show="isOpen">
    <TransitionChild
      as="template"
      enter="ease-out duration-300"
      enter-from="opacity-0"
      enter-to="opacity-100"
      leave="ease-in duration-200"
      leave-from="opacity-100"
      leave-to="opacity-0"
    >
      <BgOverlay @close="closeOverlay" />
    </TransitionChild>

    <div class="absolute inset-0 z-100 overflow-y-auto pt-[1px] flex items-center justify-center pointer-events-none">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
        enter-to="opacity-100 translate-y-0 sm:scale-100"
        leave="ease-in duration-200"
        leave-from="opacity-100 translate-y-0 sm:scale-100"
        leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
      >
        <div
          class="bg-white border border-black/40 px-3 pt-6 pb-4 rounded-lg pointer-events-auto shadow-xl relative w-160 min-h-60 overflow-scroll"
        >
          <SecuritySettingsOverview v-if="currentScreen === 'overview'" @close="closeOverlay" @goto="goto" />
          <SecuritySettingsEncrypt v-if="currentScreen === 'encrypt'" @close="closeOverlay" @goto="goto" />
          <SecuritySettingsMnemonics v-if="currentScreen === 'mnemonics'" @close="closeOverlay" @goto="goto" />
        </div>
      </TransitionChild>
    </div>
  </TransitionRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { TransitionChild, TransitionRoot } from '@headlessui/vue';
import emitter from '../emitters/basic';
import BgOverlay from '../components/BgOverlay.vue';
import SecuritySettingsOverview from './security-settings/Overview.vue';
import SecuritySettingsEncrypt from './security-settings/Encrypt.vue';
import SecuritySettingsMnemonics from './security-settings/Mnemonics.vue';

const isOpen = Vue.ref(false);
const currentScreen = Vue.ref<'overview' | 'encrypt' | 'mnemonics'>('overview');

emitter.on('openSecuritySettingsOverlay', async (data: any) => {
  isOpen.value = true;
  currentScreen.value = 'overview';
});

function closeOverlay() {
  isOpen.value = false;
}

function goto(screen: 'overview' | 'encrypt' | 'mnemonics') {
  currentScreen.value = screen;
}
</script>
