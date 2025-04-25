<template>
  <div :class="serverConnection.hasError ? 'pt-16' : 'pt-20'" class="Panel CloudMachineIsProvisioning flex flex-col px-[15%] h-full pb-16">
    <h1 class="text-4xl font-bold">Initializing Your Cloud Machine</h1>
    
    <p v-if="serverConnection.hasError" class="pt-3 font-light">There was an error setting up your server on Digital Ocean. See below for details.</p>
    <p v-else class="pt-3 font-light">We are verifying and setting up your {{serverConnection.ipAddress}} server on Digital Ocean. This may take up to 24 hours. You can close this Commander app without disrupting the setup process.</p>

    <ul class="flex flex-col pt-2 grow">
      <template v-for="step in serverConnection.steps" :key="step.key">
        <li v-if="step.status !== 'hidden'" :status="step.status" :style="{ height: `${stepHeightPct}%`, opacity: serverConnection.hasError ? '0.5' : '1' }" class="relative flex flex-row items-center border-t border-slate-300 text-black/30 whitespace-nowrap w-full pl-1">
          <div spinner></div>
          <label>{{ getLabel(step) }}</label>
          <ProgressBar v-if="['working', 'completing', 'completed', 'failed'].includes(step.status)" :disabled="step.status === 'failed'" :progress="step.progress" :is-slow="step.isSlow" />
        </li>
        <li v-if="step.status === 'failed'" class="relative flex flex-col border-t border-slate-300 text-black/70 w-full px-2 py-4 grow">
          <div class="absolute top-2 left-0 bottom-0 w-full z-0" style="background-image: linear-gradient(to bottom, #FAD1D8 90%, transparent 100%);"></div>
          <div class="flex flex-row items-center whitespace-nowrap px-2 relative z-10 pt-2">
            <AlertIcon class="w-7 h-7 mr-2.5 text-argon-button" />
            <label class="font-bold text-lg grow">FAILED to {{ getLabel(step, -1) }}</label>
            <button v-if="step.key === 'ssh'" class="text-argon-button font-bold px-4 py-0.5 border border-argon-button rounded cursor-pointer hover:border-argon-button-hover hover:text-argon-button-hover mr-2">Configure Cloud Machine</button>
            <button @click="openServerRemoveOverlay" v-else class="text-argon-button font-bold px-4 py-0.5 border border-argon-button rounded cursor-pointer hover:border-argon-button-hover hover:text-argon-button-hover mr-2">Remove Server</button>
            <button @click="runRetryStep(step)" class="text-white font-bold bg-argon-button px-4 py-0.5 border border-fuchsia-800 rounded cursor-pointer hover:bg-argon-button-hover">Retry</button>
          </div>
          <p v-if="step.key === 'ssh'" class="text-black/70 border-t border-slate-400/50 pt-3 mt-3 px-5 relative z-10">
            Commander could not connect to your server. Click the Configure Cloud Machine button if your IP address has changed. You can also retry the connection. If this issue persists, you 
            might need to remove the current server and start afresh with a new one.
          </p>
          <p v-else class="text-black/70 border-t border-slate-400/50 pt-3 mt-3 px-5 relative z-10">
            Commander has encountered an unrecoverable error while trying to provision your server. You can rerun this step by clicking Retry. If the issue persists, you 
            might need to remove the current server and start afresh with a new one.
          </p>
        </li>
      </template>
    </ul>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useConfigStore } from '../../stores/config';
import type { IStep } from '../../lib/Provisioner';
import ProgressBar from '../../components/ProgressBar.vue';
import { storeToRefs } from 'pinia';
import AlertIcon from '../../assets/alert.svg';
import emitter from '../../emitters/basic';

const configStore = useConfigStore();
const { serverConnection } = storeToRefs(configStore);

const stepHeightPct = Vue.computed(() => {
  let totalHeight = 100;
  if (serverConnection.value.errorType === 'bitcoinsync') {
    totalHeight -= 7;
  } else if (serverConnection.value.errorType === 'argonsync') {
    totalHeight -= 22;
  } else if (serverConnection.value.errorType === 'minerlaunch') {
    totalHeight -= 35;
  }
  return totalHeight / serverConnection.value.steps.length;
});

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
    case 'failed':
      return 1;
  }
  return 0;
}

function getLabel(step: IStep, offset: number = 0) {
  return step.labels[getLabelNumber(step) + offset];
}

function runRetryStep(step: IStep) {
  configStore.runRetryStep(step);
}

function openServerRemoveOverlay() {
  emitter.emit('openServerRemoveOverlay');
}
</script>

<style>
@reference "../../main.css";

.Panel.CloudMachineIsProvisioning {
  ul {
    @apply mt-4; /* border-b border-slate-300 */
    li {
      &[status="completed"], &[status="completing"] {
        @apply text-gray-700 font-bold;
      }

      &[status="working"], &[status="completing"], &[status="failed"] {
        label {
          @apply text-gray-700 font-bold relative;
        }
      
        [spinner] {
          border-radius: 50%;
          display: block;
          border: 10px solid;
          border-color: rgba(166, 0, 212, 0.15) rgba(166, 0, 212, 0.25) rgba(166, 0, 212, 0.35) rgba(166, 0, 212, 0.5);
          animation: rotation 1s linear infinite;
        }
      }

      &[status="failed"] {
        label {
          @apply text-red-900/70;
        }

        [spinner] {
          display: none;
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
