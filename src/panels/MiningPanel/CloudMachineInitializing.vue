<template>
  <div class="Panel CloudMachineInitializing flex flex-col px-[15%] h-full pt-20 pb-16">
    <h1 class="text-4xl font-bold">Initializing Your Cloud Machine</h1>
    <p class="pt-3 font-light">We are verifying and setting up your {{serverStore.address}} server on the Digital Ocean platform. This may take up to 24 hours. You can close this Commander app without disrupting the setup process.</p>

    <ul class="flex flex-col pt-2 grow">
      <li v-for="step in steps" :key="step.key" :status="step.status" :style="{ height: `${100 / steps.length}%` }">
        <div spinner></div>
        <label>{{ getLabel(step) }}</label>
        <ProgressBar v-if="step.status === 'working' || step.status === 'completing' || step.status === 'completed'" :progress="step.progress" :is-slow="step.isSlow" />
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useServerStore, type IStep } from '../../stores/server';
import ProgressBar from '../../components/ProgressBar.vue';

const serverStore = useServerStore();
const { steps } = serverStore;

function getLabelNumber(step: IStep) {
  switch (step.status) {
    case 'pending':
      return 0;
    case 'working':
      return 1;
    case 'completing':
      return 2;
    case 'completed':
      return 2;
  }
  return 0;
}

function getLabel(step: IStep) {
  return step.labels[getLabelNumber(step)];
}
</script>

<style>
@reference "../../main.css";

.Panel.CloudMachineInitializing {
  ul {
    @apply mt-4; /* border-b border-slate-300 */
    li {
      @apply flex flex-row items-center border-t border-slate-300 text-black/30 whitespace-nowrap;
      
      &[status="completed"], &[status="completing"] {
        @apply text-gray-700 font-bold;
      }

      &[status="working"], &[status="completing"] {
        @apply text-gray-700 font-bold relative;

        [spinner] {
          @apply block;
          border-radius: 50%;
          display: inline-block;
          border: 10px solid;
          border-color: rgba(166, 0, 212, 0.15) rgba(166, 0, 212, 0.25) rgba(166, 0, 212, 0.35) rgba(166, 0, 212, 0.5);
          animation: rotation 1s linear infinite;
        }

      }

      label {
        @apply mr-5;
      }
    }

    [spinner] {
      @apply hidden min-w-8 min-h-8 w-8 h-8 border absolute top-1/2 -translate-y-1/2 -left-3 -translate-x-full;
    }
  }
}

@keyframes rotation {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
} 
    
</style>
