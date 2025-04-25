<template>
  <Dashboard v-if="serverConnection.hasMiningSeats" />
  <FirstAuctionStarted v-else-if="serverConnection.isReadyForMining" />
  <FinalSetupChecklist v-else-if="serverConnection.isProvisioned" />
  <CloudMachineIsProvisioning v-else-if="serverConnection.isConnected" />
  <BlankSlate v-else />
</template>

<script setup lang="ts">
import BlankSlate from './mining-panel/BlankSlate.vue';
import FinalSetupChecklist from './mining-panel/FinalSetupChecklist.vue';
import CloudMachineIsProvisioning from './mining-panel/CloudMachineIsProvisioning.vue';
import FirstAuctionStarted from './mining-panel/FirstAuctionStarted.vue';
import Dashboard from './mining-panel/Dashboard.vue';
import { useConfigStore } from '../stores/config';

const configStore = useConfigStore();
const serverConnection = configStore.serverConnection;
</script>
