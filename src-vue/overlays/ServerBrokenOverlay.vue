<!-- prettier-ignore -->
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
          class="flex flex-col w-160 bg-white border border-black/40 px-7 pb-4 rounded-lg pointer-events-auto shadow-xl relative overflow-scroll"
        >
          <h2 class="text-xl font-bold text-slate-800/70 pt-5 border-b border-slate-300 pb-3">
            Oops... Your Server Is Having Issues
          </h2>

          <p class="pt-5 pb-6">
            An unknown error on your cloud machine is causing one of the processes to fail. Please check the server logs
            for more details. Click Restart to see if it fixes the issue.
          </p>

          <button
            @click="restart"
            class="bg-argon-500 text-white font-bold px-4 py-2 rounded-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="isRestarting"
          >
            {{ isRestarting ? 'Restarting Server...' : 'Restart Server' }}
          </button>
        </div>
      </TransitionChild>
    </div>
  </TransitionRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { TransitionChild, TransitionRoot } from '@headlessui/vue';
import BgOverlay from '../components/BgOverlay.vue';
import { useStats } from '../stores/stats';

const stats = useStats();

const isOpen = Vue.ref(true);
const isRestarting = Vue.ref(false);

const restart = async () => {
  isRestarting.value = true;
  await stats.restartBot();
  isRestarting.value = false;
};
</script>
