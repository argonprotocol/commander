<!-- prettier-ignore -->
<template>
  <div class="Component InstallProgress flex flex-col grow relative h-full">
    <div v-if="hasInvalidLocalShasums" class="relative flex flex-col border-t border-slate-300 text-black/70 w-full px-2 py-4 grow h-full">
      <div
        class="absolute top-0 left-0 bottom-0 w-full z-0"
        style="background-image: linear-gradient(to bottom, transparent 0%, #fad1d8 90%)"
      ></div>
      <div class="flex flex-row items-center whitespace-nowrap relative z-10 pt-4">
        <AlertIcon class="w-7 h-7 mr-2.5 text-argon-button" />
        <label class="font-bold text-lg truncate grow">Local Files Outdated</label>
        <button
          @click="retryFailedStep(InstallStepKey.ServerConnect)"
          class="text-white font-bold bg-argon-button px-4 py-0.5 border border-fuchsia-800 rounded cursor-pointer hover:bg-argon-button-hover"
        >
          <span v-if="isRetrying">Retrying...</span>
          <span v-else>Retry</span>
        </button>
      </div>
      <p class="text-black/70 pt-3 mt-3 px-2.5 relative z-10">
        Your local files do not match your local shasums. Please update and try again. You will probably need to
        shutdown and restart this app.
      </p>
    </div>
    <ul v-else :isCompact="isCompact" class="flex flex-col grow relative h-full">
      <template v-for="(stepLabel, index) in stepLabels" :key="stepLabel.key">
        <InstallProgressStep
          :stepLabel="stepLabel"
          :stepIndex="index"
          :stepsCount="stepLabels.length"
          :isCompact="isCompact"
        />
      </template>
    </ul>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { stepLabels } from '../lib/InstallerStep';
import InstallProgressStep from './InstallProgressStep.vue';
import { useInstaller } from '../stores/installer';
import { ReasonsToSkipInstall } from '../lib/Installer';
import { InstallStepKey } from '../interfaces/IConfig';
import AlertIcon from '../assets/alert.svg?component';

const props = defineProps<{
  isCompact?: boolean;
}>();

const installer = useInstaller();

const isRetrying = Vue.ref(false);

const hasInvalidLocalShasums = Vue.computed(() => {
  return installer.reasonToSkipInstall === ReasonsToSkipInstall.LocalShasumsNotAccurate;
});

async function retryFailedStep(stepKey: InstallStepKey) {
  isRetrying.value = true;
  await installer.runFailedStep(stepKey);
  isRetrying.value = false;
}
</script>

<style>
@reference "../main.css";

.Component.InstallProgress {
  @apply mt-4; /* border-b border-slate-300 */
}
</style>
