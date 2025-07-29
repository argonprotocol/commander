<template>
  <div class="flex flex-col gap-2 px-3">
    <p v-if="config.isValidJurisdiction" class="text-slate-800 text-md">
      As a residence of the Cayman Islands, you have been given the fully unlocked version of Commander. If you reside
      in another jurisdiction, please fix your country of residence below so that this app can remain compliant.
    </p>
    <p v-else class="text-slate-800 text-md">
      This version of Commander has some features disabled. The more advanced capabilities are reserved for the
      residents of Cayman Islands. If our geolocation service made a mistake, please fix it below.
    </p>

    <div class="flex flex-col gap-2 text-center py-5 w-8/12 mx-auto mb-1">
      <span class="font-bold pb-2 border-b border-slate-300 border-dashed">Your Detected Country of Residence</span>
      <div>
        <AlertIcon
          v-if="!config.isValidJurisdiction"
          class="w-5 h-5 text-yellow-700/80 inline-block mr-1 relative -top-0.5"
        />
        {{ config.userJurisdiction.countryName }}
        <span class="font-light">(</span>
        <span @click="fixJurisdiction" class="text-argon-500 hover:text-argon-600 cursor-pointer inline">
          {{ config.isValidJurisdiction ? 'change' : 'fix' }} jurisdiction
        </span>
        <span class="font-light">)</span>
      </div>
    </div>

    <button
      @click="closeOverlay"
      class="w-full cursor-pointer bg-slate-600/20 hover:bg-slate-600/15 border border-slate-900/10 inner-button-shadow text-slate-900 px-4 py-1 rounded-lg focus:outline-none"
    >
      Close
    </button>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useConfig } from '../../stores/config';
import AlertIcon from '../../assets/alert.svg?component';

const emit = defineEmits(['close', 'goto']);

const config = useConfig();

function fixJurisdiction() {
  emit('goto', 'fixJurisdiction');
}

function closeOverlay() {
  emit('close');
}
</script>
