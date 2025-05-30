<template>
  <ul :isCompact="isCompact" class="Component InstallStatus flex flex-col grow relative h-full">
    <template v-for="step in installer.steps" :key="step.key">
      <li v-if="!['hidden', 'failed'].includes(step.status)" :status="step.status" :style="{ height: `${stepHeightPct}%`, opacity: hasError ? '0.5' : '1' }" class="relative flex flex-row items-center border-t border-slate-300 text-black/30 whitespace-nowrap w-full pl-1">
        <div v-if="step.status === 'working'" spinner />
        <Checkbox v-if="step.status === 'completed'" :isChecked="true" class="absolute top-1/2 -translate-y-1/2 left-0 w-4 h-4 max-w-4 max-h-4" />
        <label>{{ getLabel(step) }}</label>
        <ProgressBar v-if="['working', 'completing', 'completed', 'failed'].includes(step.status)" :hasError="step.status === 'failed'" :progress="step.progress" :is-slow="step.isSlow" />
      </li>
      <li v-if="step.status === 'failed'" :class="{ 'opacity-50 pointer-events-none': isRetrying }" class="relative flex flex-col border-t border-slate-300 text-black/70 w-full px-2 py-4 grow h-full">
        <div class="absolute top-2 left-0 bottom-0 w-full z-0" style="background-image: linear-gradient(to bottom, #FAD1D8 90%, transparent 100%);"></div>
        <div class="flex flex-row items-center whitespace-nowrap px-2 relative z-10 pt-4">
          <AlertIcon class="w-7 h-7 mr-2.5 text-argon-button" />
          <label class="font-bold text-lg truncate grow">FAILED to {{ getLabel(step, -1) }}</label>
          <button v-if="!isRetrying && step.key === 'ssh'" class="text-argon-button font-bold px-4 py-0.5 border border-argon-button rounded cursor-pointer hover:border-argon-button-hover hover:text-argon-button-hover mr-2">Configure Cloud Machine</button>
          <button v-else-if="!isRetrying" @click="openServerRemoveOverlay" class="text-argon-button font-bold px-4 py-0.5 border border-argon-button rounded cursor-pointer hover:border-argon-button-hover hover:text-argon-button-hover mr-2">Remove Server</button>
          <button @click="runRetryStep(step)" class="text-white font-bold bg-argon-button px-4 py-0.5 border border-fuchsia-800 rounded cursor-pointer hover:bg-argon-button-hover">
            <span v-if="isRetrying">Retrying...</span>
            <span v-else>Retry</span>
          </button>
        </div>
        <p v-if="step.key === 'ssh'" class="text-black/70 border-t border-slate-400/50 pt-3 mt-3 px-2.5 relative z-10">
          Commander could not connect to your server. Click the Configure Cloud Machine button if your IP address has changed. You can also retry the connection. If this issue persists, you 
          might need to remove the current server and start afresh with a new one.
        </p>
        <p v-else class="text-black/70 border-t border-slate-400/50 pt-3 pb-5 mt-3 px-2.5 relative z-10">
          Commander has encountered an unrecoverable error while trying to provision your server. You can rerun this step by clicking Retry. If the issue persists, you 
          might need to remove the current server and start afresh with a new one.
        </p>
      </li>
    </template>
  </ul>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useConfigStore } from '../stores/config';
import Installer, { IStep } from '../lib/Installer';
import ProgressBar from '../components/ProgressBar.vue';
import Checkbox from '../components/Checkbox.vue';
import { storeToRefs } from 'pinia';
import AlertIcon from '../assets/alert.svg';
import emitter from '../emitters/basic';

const props = defineProps<{
  isCompact?: boolean;
}>();

const configStore = useConfigStore();
const { serverDetails, installStatus } = storeToRefs(configStore);

const installer = new Installer(installStatus.value);
const isRetrying = Vue.ref(false);

installer.finishedFn = () => {
  configStore.serverDetails.isInstalling = false;
  emitter.emit('openProvisioningCompleteOverlay');
};

const hasError = Vue.computed(() => {
  return installer.hasError.value;
});

Vue.watch(() => serverDetails.value.ipAddress, (ipAddress) => {
  installer.setIpAddress(ipAddress);
}, { immediate: true });

const stepHeightPct = Vue.computed(() => {
  let totalHeight = 100;
  if (installer.errorType.value === 'BitcoinInstall') {
    totalHeight -= 7;
  } else if (installer.errorType.value === 'ArgonInstall') {
    totalHeight -= 22;
  } else if (installer.errorType.value === 'DockerLaunch') {
    totalHeight -= 35;
  }
  return totalHeight / installer.steps.length;
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

async function runRetryStep(step: IStep) {
  isRetrying.value = true;
  await installer.retryStep(step);
  isRetrying.value = false;
}

function openServerRemoveOverlay() {
  emitter.emit('openServerRemoveOverlay');
}

Vue.onUnmounted(() => {
  installer.stop()
});
</script>

<style>
@reference "../main.css";

.Component.InstallStatus {
  &[isCompact="true"] {
    label {
      @apply mr-3;
    }
    li [spinner] {
      @apply -left-0 -translate-x-0 min-w-6 min-h-6 w-6 h-6;
    }
    li[status="working"], li[status="completing"], li[status="completed"] {
      label {
        @apply pl-7;
      }
    }
  }

  @apply mt-4; /* border-b border-slate-300 */
  li {
    @apply py-2 flex-1;

    &[status="working"], &[status="completing"] {
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
    }

    &[status="completed"] {
      .ProgressBar {
        @apply opacity-70;
      }
    }

    label {
      @apply mr-5 text-gray-700/50 font-bold;
    }
  }

  [spinner] {
    @apply hidden min-w-8 min-h-8 w-8 h-8 border absolute top-1/2 -translate-y-1/2 -left-3 -translate-x-full;
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