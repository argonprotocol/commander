<!-- prettier-ignore -->
<template>
  <div class="flex flex-col h-full w-full cursor-default">
    <div class="grow relative bg-white rounded border border-[#CCCEDA] shadow text-center m-3 overflow-hidden">
      <div
        v-if="!stats.isBotBroken && !config.isWaitingForUpgradeApproval"
        class="relative mx-auto inline-block w-6/10 h-full"
      >
        <div class="fade-in-out text-5xl font-bold text-gray-300 text-center mt-32 mb-4 whitespace-nowrap pt-16">
          CONNECTING TO
          <div class="text-7xl">BIDDING BOT</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useStats } from '../../stores/stats';
import { useConfig } from '../../stores/config';

const stats = useStats();
const config = useConfig();

Vue.onMounted(() => {
  stats.start();
});

Vue.onUnmounted(() => {
  stats.stop();
});
</script>

<style scoped>
@reference "../../main.css";

.fade-in-out {
  animation: fadeInOut 1.5s ease-in-out infinite;
  animation-delay: 0s;
}

@keyframes fadeInOut {
  0% {
    opacity: 0.1;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.1;
  }
}
</style>
