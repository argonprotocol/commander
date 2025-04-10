<template>
  <div v-if="serverStore.isLoading" class="flex flex-col items-center justify-center h-full opacity-50 text-2xl uppercase">Loading...</div>
  <CloudMachineInitialized v-else-if="serverStore.isSetup" />
  <CloudMachineInitializing v-else-if="serverStore.isSaved" />
  <BlankSlate v-else />
</template>

<script setup lang="ts">
import BlankSlate from './MiningPanel/BlankSlate.vue';
import CloudMachineInitialized from './MiningPanel/CloudMachineInitialized.vue';
import CloudMachineInitializing from './MiningPanel/CloudMachineInitializing.vue';
import { useServerStore } from '../stores/server';

const serverStore = useServerStore();
</script>
