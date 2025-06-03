<template>
  <BlankSlate v-if="!serverDetails.isConnected" />
  <CloudMachineIsProvisioning v-if="serverDetails.isInstalling && serverDetails.isNewServer" />
  <Dashboard v-else-if="serverDetails.hasMiningSeats" />
  <FirstAuction v-else-if="serverDetails.isReadyForMining" />
  <FinalSetupChecklist v-else />  
</template>

<script setup lang="ts">
import BlankSlate from './mining-panel/BlankSlate.vue';
import FinalSetupChecklist from './mining-panel/FinalSetupChecklist.vue';
import CloudMachineIsProvisioning from './mining-panel/CloudMachineIsProvisioning.vue';
import FirstAuction from './mining-panel/FirstAuction.vue';
import Dashboard from './mining-panel/Dashboard.vue';
import { useConfigStore } from '../stores/config';

const configStore = useConfigStore();
const serverDetails = configStore.serverDetails;
</script>
