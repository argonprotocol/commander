<template>
  <div :class="hasError ? 'pt-16' : 'pt-20'" class="Panel CloudMachineIsInstalling flex flex-col px-[15%] h-full pb-16">
    <h1 class="text-4xl font-bold">Initializing Your Cloud Machine</h1>

    <p v-if="hasError" class="pt-3 font-light">
      There was an error setting up your server on Digital Ocean. See below for details.
    </p>
    <p v-else class="pt-3 pb-2 font-light">
      We are verifying and setting up your {{ serverDetails.ipAddress }} server on Digital Ocean. This may take several
      hours. You can close this Commander app without disrupting the process once the core files have finished
      uploading.
    </p>
    <InstallProgress />
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useConfig } from '../../stores/config';
import { useInstaller } from '../../stores/installer';
import InstallProgress from '../../components/InstallProgress.vue';
import { ReasonsToSkipInstall } from '../../lib/Installer';

const config = useConfig();
const installer = useInstaller();

const installDetails = Vue.computed(() => config.installDetails);
const serverDetails = Vue.computed(() => config.serverDetails);

const hasError = Vue.computed(() => {
  if (installer.reasonToSkipInstall === ReasonsToSkipInstall.LocalShasumsNotAccurate) {
    return true;
  }
  return installDetails.value.errorType;
});
</script>
