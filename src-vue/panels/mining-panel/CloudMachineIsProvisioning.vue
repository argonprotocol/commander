<template>
  <div :class="installDetails.errorType ? 'pt-16' : 'pt-20'" class="Panel CloudMachineIsProvisioning flex flex-col px-[15%] h-full pb-16">
    <h1 class="text-4xl font-bold">Initializing Your Cloud Machine</h1>
    
    <p v-if="installDetails.errorType" class="pt-3 font-light">There was an error setting up your server on Digital Ocean. See below for details.</p>
    <p v-else class="pt-3 pb-2 font-light">
      We are verifying and setting up your {{serverDetails.ipAddress}} server on Digital Ocean. This may take several hours. You can close this 
      Commander app once the core files have finished uploading without disrupting the process.
    </p>
    <InstallProgress />
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useConfig } from '../../stores/config';
import InstallProgress from '../../components/InstallProgress.vue';

const config = useConfig();
const installDetails = Vue.computed(() => config.installDetails);
const serverDetails = Vue.computed(() => config.serverDetails);
</script>
