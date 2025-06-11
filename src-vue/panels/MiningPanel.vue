<template>
  <BlankSlate v-if="!config.isServerConnected" />
  <CloudMachineIsProvisioning v-else-if="config.isServerInstalling && config.isServerNew" />
  <Dashboard v-else-if="config.hasMiningSeats" />
  <FirstAuction v-else-if="config.isServerReadyForMining" />
  <FinalSetupChecklist v-else />  
</template>

<script setup lang="ts">
import BlankSlate from './mining-panel/BlankSlate.vue';
import FinalSetupChecklist from './mining-panel/FinalSetupChecklist.vue';
import CloudMachineIsProvisioning from './mining-panel/CloudMachineIsProvisioning.vue';
import FirstAuction from './mining-panel/FirstAuction.vue';
import Dashboard from './mining-panel/Dashboard.vue';
import { useConfig } from '../stores/config';

const config = useConfig();
</script>
