<!-- prettier-ignore -->
<template>
  <BlankSlate v-if="!config.hasSavedVaultingRules" />
  <FinalSetupChecklist v-else-if="!config.isVaultReadyToCreate" />
</template>

<script setup lang="ts">
import BlankSlate from './vaulting-panel/BlankSlate.vue';
import FinalSetupChecklist from './vaulting-panel/FinalSetupChecklist.vue';
import { useConfig } from '../stores/config';

const config = useConfig();
</script>
