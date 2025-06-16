<template>
  <h2
    class="flex flex-row justify-between items-center text-2xl font-bold text-slate-800/70 border-b border-slate-300 pb-3 pl-2 pr-3 mb-6"
  >
    <div class="flex flex-row items-center hover:bg-[#f1f3f7] rounded-md p-1 pl-0 mr-2 cursor-pointer">
      <ChevronLeftIcon @click="goBack" class="w-6 h-6 cursor-pointer relative -top-0.25" />
    </div>
    <div class="grow">Encryption Passphrase</div>
    <div
      @click="closeOverlay"
      class="z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/60 hover:bg-[#f1f3f7]"
    >
      <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
    </div>
  </h2>

  <p class="text-md text-slate-500 px-3">Feature Coming Soon.</p>
</template>

<script setup lang="ts">
import { ChevronLeftIcon, XMarkIcon } from '@heroicons/vue/24/outline';

const emit = defineEmits(['close', 'goto']);

function closeOverlay() {
  emit('close');
}

function goBack() {
  emit('goto', 'overview');
}
</script>
