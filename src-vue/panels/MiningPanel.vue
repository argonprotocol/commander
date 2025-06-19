<template>
  <BlankSlate v-if="!config.isServerConnected" />
  <CloudMachineIsInstalling v-else-if="!config.isServerInstalled" />
  <Dashboard v-else-if="config.hasMiningSeats" />
  <FirstAuction v-else-if="config.isServerReadyForBidding" />
  <FinalSetupChecklist v-else />
</template>

<script setup lang="ts">
import BlankSlate from './mining-panel/BlankSlate.vue';
import FinalSetupChecklist from './mining-panel/FinalSetupChecklist.vue';
import CloudMachineIsInstalling from './mining-panel/CloudMachineIsInstalling.vue';
import FirstAuction from './mining-panel/FirstAuction.vue';
import Dashboard from './mining-panel/Dashboard.vue';
import { useConfig } from '../stores/config';

const config = useConfig();
</script>
