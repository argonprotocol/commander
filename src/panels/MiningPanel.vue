<template>
  <CloudMachineIsProvisioning v-if="serverConnection.isConnected && !serverConnection.isProvisioned" />
  <Dashboard v-else-if="serverConnection.hasMiningSeats" />
  <FirstAuction v-else-if="serverConnection.isReadyForMining" />
  <FinalSetupChecklist v-else-if="serverConnection.isProvisioned" />  
  <BlankSlate v-else />
</template>

<script setup lang="ts">
import BlankSlate from './mining-panel/BlankSlate.vue';
import FinalSetupChecklist from './mining-panel/FinalSetupChecklist.vue';
import CloudMachineIsProvisioning from './mining-panel/CloudMachineIsProvisioning.vue';
import FirstAuction from './mining-panel/FirstAuction.vue';
import Dashboard from './mining-panel/Dashboard.vue';
import { useConfigStore } from '../stores/config';

const configStore = useConfigStore();
const serverConnection = configStore.serverConnection;
</script>
