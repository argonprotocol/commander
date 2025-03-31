<template>
  <div v-if="serverStore.isLoading" class="flex flex-col items-center justify-center h-full opacity-50 text-2xl uppercase">Loading...</div>
  <CloudMachineReady v-else-if="serverStore.isSetup" />
  <CloudMachineInitializing v-else-if="serverStore.isSaved" />
  <BlankSlate v-else />
</template>

<script setup lang="ts">
import BlankSlate from './MiningPanel/BlankSlate.vue';
import CloudMachineReady from './MiningPanel/CloudMachineReady.vue';
import CloudMachineInitializing from './MiningPanel/CloudMachineInitializing.vue';
import { useServerStore } from '../stores/server';

const serverStore = useServerStore();
</script>
