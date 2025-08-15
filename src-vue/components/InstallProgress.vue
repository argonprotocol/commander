<!-- prettier-ignore -->
<template>
  <div class="Component InstallProgress flex flex-col grow relative h-full">
    <ul :isCompact="isCompact" class="flex flex-col grow relative h-full">
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
