<!-- prettier-ignore -->
<template>
  <div :class="hasError ? 'pt-16' : 'pt-20'" class="Panel CloudMachineIsInstalling flex flex-col px-[15%] h-full pb-16">
    <h1 class="text-4xl font-bold">{{ installer.isFreshInstall ? 'Installing' : 'Upgrading' }} Your Cloud Machine...</h1>

      <p v-if="hasError" class="pt-3 font-light">
      There was an error setting up your server on {{serverDetails.type}}. See below for details.
    </p>
    <p class="pt-3 pb-2 font-light" v-else-if="installer.isFreshInstall">
      We are verifying and setting up your {{ serverDetails.ipAddress }} server on {{ serverDetails.type }}. This may take several
      hours to complete.
    </p>
    <p class="pt-3 pb-2 font-light" v-else>
      We are updating the bot program on your {{ serverDetails.ipAddress }} server on {{ serverDetails.type }}. This will only
      take a few minutes to complete.
    </p>

    <InstallProgress />
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useConfig } from '../../stores/config';
import { useInstaller } from '../../stores/installer';
import InstallProgress from '../../components/InstallProgress.vue';

const config = useConfig();
const installer = useInstaller();

const installDetails = Vue.computed(() => config.installDetails);
const serverDetails = Vue.computed(() => config.serverDetails);

const hasError = Vue.computed(() => {
  return installDetails.value.errorType;
});
</script>
