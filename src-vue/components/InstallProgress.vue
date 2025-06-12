<template>
  <ul :isCompact="isCompact" class="Component InstallProgress flex flex-col grow relative h-full">
    <template v-for="step in steps" :key="step.key">
      <InstallProgressStep :step="step" :stepCount="steps.length" :isCompact="isCompact" />
    </template>
  </ul>
</template>

<script setup lang="ts">
import type { IStep } from '../lib/InstallerStep';
import { stepMetas } from '../lib/InstallerStep';
import InstallProgressStep from './InstallProgressStep.vue';

const props = defineProps<{
  isCompact?: boolean;
}>();

const steps: IStep[] = [ ...stepMetas ];

</script>

<style>
@reference "../main.css";

.Component.InstallProgress {
  @apply mt-4; /* border-b border-slate-300 */
}
</style>