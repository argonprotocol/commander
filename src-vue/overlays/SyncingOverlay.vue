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
      <BgOverlay />
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
          class="flex flex-col w-6/12 bg-white border border-black/40 px-7 pb-8 rounded-lg pointer-events-auto shadow-xl relative overflow-scroll"
        >
          <h2 class="text-2xl font-bold text-slate-800/70 border-b border-slate-300 pt-6 pb-3 mb-3">
            Syncing Your Cloud Machine
          </h2>
          <div v-if="config.syncDetails.errorType" class="flex flex-row items-center gap-x-2">
            <AlertIcon class="w-4 h-4 text-red-600 relative inline-block" />
            <div class="text-red-500">There was an error syncing your cloud machine.</div>
            <button
              class="text-red-500 border border-red-500 rounded-md px-3 text-md cursor-pointer hover:bg-red-500 hover:text-white"
              @click="retrySync"
            >
              {{ isRetrying ? 'Retrying...' : 'Retry' }}
            </button>
          </div>
          <ProgressBar :progress="config.syncDetails.progress" class="mt-3" />
        </div>
      </TransitionChild>
    </div>
  </TransitionRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { TransitionChild, TransitionRoot } from '@headlessui/vue';
import BgOverlay from '../components/BgOverlay.vue';
import { useConfig } from '../stores/config';
import ProgressBar from '../components/ProgressBar.vue';
import AlertIcon from '../assets/alert.svg?component';
import { useStats } from '../stores/stats';

const isOpen = Vue.ref(true);
const isRetrying = Vue.ref(false);
const config = useConfig();
const stats = useStats();

async function retrySync() {
  isRetrying.value = true;
  // stats.retrySync();
  isRetrying.value = false;
}
</script>
