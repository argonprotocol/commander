<template>
  <TransitionRoot class='absolute inset-0 z-10' :show="isOpen">
    <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
      <BgOverlay />
    </TransitionChild>

    <div class="absolute inset-0 z-100 overflow-y-auto pt-[1px] flex items-center justify-center pointer-events-none">
      <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" enter-to="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200" leave-from="opacity-100 translate-y-0 sm:scale-100" leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
        <div class="flex flex-col w-6/12 bg-white border border-black/40 px-7 pb-8 rounded-lg pointer-events-auto shadow-xl relative overflow-scroll">
          <h2 class="text-2xl font-bold text-slate-800/70 border-b border-slate-300 pt-6 pb-3 mb-6">
            Syncing Your Cloud Machine
          </h2>
          <ProgressBar :progress="stats.syncProgress" />
        </div>
      </TransitionChild>
    </div>
  </TransitionRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { TransitionChild, TransitionRoot } from '@headlessui/vue';
import BgOverlay from '../components/BgOverlay.vue';
import { useConfigStore } from '../stores/config';
import ProgressBar from '../components/ProgressBar.vue';
import { storeToRefs } from 'pinia';

const isOpen = Vue.ref(true);
const configStore = useConfigStore();
const { stats } = storeToRefs(configStore);

</script>