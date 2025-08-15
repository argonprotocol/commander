<template>
  <div v-if="hasStarted" class="flex flex-col gap-4 min-h-[90%] font-mono px-4 py-2 min-w-180">
    <section :run="diagnostics.isConnected">
      <header class="relative">
        <Motion :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :transition="{ duration: 0.5 }">
          <Motion
            :initial="{ width: 0 }"
            :animate="{ width: '100%' }"
            :transition="{ duration: 1.5, ease: 'easeOut' }"
            class="overflow-hidden whitespace-nowrap"
          >
            Checking SSH Connection to Cloud Machine
          </Motion>
        </Motion>
        <label class="text-green-600 font-bold absolute right-5 top-0">Y</label>
      </header>
      <success class="text-slate-800/50 font-md font-light pr-5">
        Connected to {{ config.serverDetails.ipAddress }}
      </success>
      <!-- <failure>Failed to connect to {{ config.serverDetails.ipAddress }}. Your internet connection might be down or the cloud machine might be offline.</failure> -->
    </section>

    <section :run="diagnostics.accountAddressMatches">
      <header class="relative">
        <Motion :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :transition="{ duration: 0.5 }">
          <Motion
            :initial="{ width: 0 }"
            :animate="{ width: '100%' }"
            :transition="{ duration: 1.5, ease: 'easeOut' }"
            class="overflow-hidden whitespace-nowrap"
          >
            Checking Argon Account Identifier Match
          </Motion>
        </Motion>
        <label class="text-green-600 font-bold absolute right-5 top-0">Y</label>
      </header>
      <success class="text-slate-800/50 font-md font-light pr-5">
        Your app database and the cloud machine are using the same account address.
      </success>
      <!-- <failure>Your app database and the cloud machine are using different account addresses.</failure> -->
    </section>

    <!-- <section :run="diagnostics.remoteFilesAreUpToDate">
    <header>Remote Server Files Are Up-to-Date</header>
    <success :data="{ files: ['/bot', '/scripts', '/deploy', '/calculator'] }">
      /bot /scripts /deploy /calculator
    </success>
  </section>

  <section :run="diagnostics.configFilesAreCorrect">
    <header>Config Files Are Correct</header>
    <success>
      All config files are correct.
    </success>
    <failure>One or more config files are incorrect.</failure>
  </section>

  <section :run="diagnostics.lastInstallCompletedSuccessfully">
    <header>Last Install Completed Successfully</header>
    <success :data="{ installDetails: config.installDetails }">
      The last install completed successfully.
    </success>
    <failure>
      The last install did not complete successfully.
    </failure>
  </section>

  <section>
    <header>Ubuntu Is Running Correct Version</header>
  </section>

  <section>
    <header>Bitcoin Node Is Working</header>
    <div>
      <div></div>
    </div>
  </section>

  <section>
    <header>Argon Node Is Working</header>
  </section>

  <section>
    <header>Mining Bot Is Working</header>
  </section>

  <section>
    <header>Mining Data Is Correct</header>
  </section>

  <section></section> -->
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { Motion } from 'motion-v';
import { Diagnostics } from '../../lib/Diagnostics';
import { useConfig } from '../../stores/config';

const hasStarted = Vue.ref(false);
const config = useConfig();

const diagnostics = new Diagnostics();

function runDiagnostics() {
  hasStarted.value = true;
  diagnostics.run();
}

Vue.onMounted(() => {
  runDiagnostics();
});
</script>
