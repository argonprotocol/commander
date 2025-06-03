<template>
  <div :class="serverDetails.hasError ? 'pt-16' : 'pt-20'" class="Panel CloudMachineIsProvisioning flex flex-col px-[15%] h-full pb-16">
    <h1 class="text-4xl font-bold">Initializing Your Cloud Machine</h1>
    
    <p v-if="serverDetails.hasError" class="pt-3 font-light">There was an error setting up your server on Digital Ocean. See below for details.</p>
    <p v-else class="pt-3 pb-2 font-light">We are verifying and setting up your {{serverDetails.ipAddress}} server on Digital Ocean. This may take several hours. You can close this Commander app without disrupting the setup process.</p>
    <InstallStatus />
  </div>
</template>

<script setup lang="ts">
import { useConfigStore } from '../../stores/config';
import { storeToRefs } from 'pinia';
import InstallStatus from '../../components/InstallStatus.vue';

const configStore = useConfigStore();
const { serverDetails } = storeToRefs(configStore);
</script>
