<template>
  <li
    v-if="!['Hidden', 'Failed'].includes(stepStatus)"
    :status="stepStatus"
    :style="{ height: `${stepHeightPct}%`, opacity: hasError ? '0.5' : '1' }"
    class="Component InstallProgressStep relative flex flex-row items-center border-t border-slate-300 text-black/30 whitespace-nowrap w-full pl-1"
  >
    <div v-if="stepStatus === 'Working'" spinner />
    <Checkbox
      v-if="['Completed', 'Completing'].includes(stepStatus)"
      :isChecked="true"
      class="absolute top-1/2 -translate-y-1/2 left-0 w-4 h-4 max-w-4 max-h-4"
    />
    <label>{{ getLabel(step) }}</label>
    <ProgressBar
      v-if="['Working', 'Completing', 'Completed', 'Failed'].includes(stepStatus)"
      :hasError="stepStatus === 'Failed'"
      :progress="stepProgress"
      :is-slow="step.isSlow"
    />
  </li>
  <li
    v-if="stepStatus === 'Failed'"
    :class="{ 'opacity-50 pointer-events-none': isRetrying }"
    class="Component InstallProgressStep relative flex flex-col border-t border-slate-300 text-black/70 w-full px-2 py-4 grow h-full"
  >
    <div
      class="absolute top-2 left-0 bottom-0 w-full z-0"
      style="background-image: linear-gradient(to bottom, #fad1d8 90%, transparent 100%)"
    ></div>
    <div class="flex flex-row items-center whitespace-nowrap px-2 relative z-10 pt-4">
      <AlertIcon class="w-7 h-7 mr-2.5 text-argon-button" />
      <label class="font-bold text-lg truncate grow">FAILED to {{ getLabel(step, -1) }}</label>
      <button
        v-if="!isRetrying && step.key === InstallStepKey.ServerConnect"
        class="text-argon-button font-bold px-4 py-0.5 border border-argon-button rounded cursor-pointer hover:border-argon-button-hover hover:text-argon-button-hover mr-2"
      >
        Configure Cloud Machine
      </button>
      <button
        v-else-if="!isRetrying"
        @click="openServerRemoveOverlay"
        class="text-argon-button font-bold px-4 py-0.5 border border-argon-button rounded cursor-pointer hover:border-argon-button-hover hover:text-argon-button-hover mr-2"
      >
        Remove Server
      </button>
      <button
        @click="retryFailedStep(step)"
        class="text-white font-bold bg-argon-button px-4 py-0.5 border border-fuchsia-800 rounded cursor-pointer hover:bg-argon-button-hover"
      >
        <span v-if="isRetrying">Retrying...</span>
        <span v-else>Retry</span>
      </button>
    </div>
    <p
      v-if="step.key === InstallStepKey.ServerConnect"
      class="text-black/70 border-t border-slate-400/50 pt-3 mt-3 px-2.5 relative z-10"
    >
      Commander could not connect to your server. Click the Configure Cloud Machine button if your
      IP address has changed. You can also retry the connection. If this issue persists, you might
      need to remove the current server and start afresh with a new one.
    </p>
    <p
      v-else
      class="text-black/70 border-t border-slate-400/50 pt-3 pb-5 mt-3 px-2.5 relative z-10"
    >
      Commander has encountered an unrecoverable error while trying to provision your server. You
      can rerun this step by clicking Retry. If the issue persists, you might need to remove the
      current server and start afresh with a new one.
    </p>
  </li>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useConfig, type Config } from '../stores/config';
import type { IStep } from '../lib/InstallerStep';
import { InstallStepKey, InstallStepStatus } from '../interfaces/IConfig';
import ProgressBar from '../components/ProgressBar.vue';
import Checkbox from '../components/Checkbox.vue';
import AlertIcon from '../assets/alert.svg?component';
import emitter from '../emitters/basic';
import { useInstaller } from '../stores/installer';

const props = defineProps<{
  isCompact?: boolean;
  step: IStep;
  stepCount: number;
}>();

const config = useConfig();
const installer = useInstaller();

const step = Vue.ref<IStep>(props.step);

const isRetrying = Vue.ref(false);
const hasError = Vue.ref('');

const stepStatus = Vue.computed(() => {
  return config.installDetails[step.value.key].status;
});

const stepProgress = Vue.computed(() => {
  if (stepStatus.value === InstallStepStatus.Completed) {
    return 100;
  } else if (stepStatus.value === InstallStepStatus.Pending) {
    return 0;
  }
  return config.installDetails[step.value.key].progress;
});

// installer.finishedFn = () => {
//   config.isServerInstalling = false;
//   config.isWaitingForUpgradeApproval = false;
//   if (config.isServerNew) {
//     emitter.emit('openProvisioningCompleteOverlay');
//   }
// };

// const hasError = Vue.computed(() => {
//   return installer.hasError.value;
// });

// Vue.watch(() => config.serverDetails.ipAddress, (ipAddress) => {
//   installer.setIpAddress(ipAddress);
// }, { immediate: true });

const stepHeightPct = Vue.computed(() => {
  let totalHeight = 100;
  // if (installer.errorType.value === 'BitcoinInstall') {
  //   totalHeight -= 7;
  // } else if (installer.errorType.value === 'ArgonInstall') {
  //   totalHeight -= 22;
  // } else if (installer.errorType.value === 'MiningLaunch') {
  //   totalHeight -= 35;
  // }
  return totalHeight / props.stepCount;
});

function getLabelNumber(step: IStep) {
  switch (stepStatus.value) {
    case InstallStepStatus.Pending:
      return 0;
    case InstallStepStatus.Working:
      return 1;
    case InstallStepStatus.Completing:
      return 2;
    case InstallStepStatus.Completed:
      return 2;
    case InstallStepStatus.Failed:
      return 1;
  }
  return 0;
}

function getLabel(step: IStep, offset: number = 0) {
  return step.labels[getLabelNumber(step) + offset];
}

async function retryFailedStep(step: IStep) {
  isRetrying.value = true;
  await installer.retryFailedStep(step.key);
  isRetrying.value = false;
}

function openServerRemoveOverlay() {
  emitter.emit('openServerRemoveOverlay');
}
</script>

<style>
@reference "../main.css";

li.Component.InstallProgressStep {
  &[isCompact='true'] {
    label {
      @apply mr-3;
    }
    [spinner] {
      @apply -left-0 -translate-x-0 min-w-6 min-h-6 w-6 h-6;
    }
    &[status='Working'],
    &[status='Completing'],
    &[status='Completed'] {
      label {
        @apply pl-7;
      }
    }
  }

  @apply py-2 flex-1;

  &[status='Working'],
  &[status='Completing'] {
    label {
      @apply text-gray-700 font-bold relative;
    }

    [spinner] {
      border-radius: 50%;
      display: block;
      border: 10px solid;
      border-color: rgba(166, 0, 212, 0.15) rgba(166, 0, 212, 0.25) rgba(166, 0, 212, 0.35)
        rgba(166, 0, 212, 0.5);
      animation: rotation 1s linear infinite;
    }
  }

  &[status='Failed'] {
    label {
      @apply text-red-900/70;
    }
  }

  &[status='Completed'] {
    .ProgressBar {
      @apply opacity-70;
    }
  }

  label {
    @apply mr-5 text-gray-700/50 font-bold;
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
