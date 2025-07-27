<!-- prettier-ignore -->
<template>
  <Dashboard v-if="myVault.data.createdVault" />
  <BlankSlate v-else-if="!config.hasSavedVaultingRules" />
  <FinalSetupChecklist v-else-if="!config.isVaultReadyToCreate" />
  <VaultIsInstalling v-else-if="config.isVaultReadyToCreate" />
</template>

<script setup lang="ts">
import BlankSlate from './vaulting-panel/BlankSlate.vue';
import FinalSetupChecklist from './vaulting-panel/FinalSetupChecklist.vue';
import { useConfig } from '../stores/config';
import VaultIsInstalling from './vaulting-panel/VaultIsInstalling.vue';
import { useMyVault } from '../stores/vaults.ts';
import Dashboard from './vaulting-panel/Dashboard.vue';

const myVault = useMyVault();
const config = useConfig();
</script>
