<template>
  <TransitionRoot class='absolute inset-0 z-10' :show="isOpen">
    <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
      <BgOverlay />
    </TransitionChild>

    <div class="absolute inset-0 z-100 overflow-y-auto pt-[1px] flex items-center justify-center pointer-events-none">
      <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" enter-to="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200" leave-from="opacity-100 translate-y-0 sm:scale-100" leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
        <div :class="isUpgrading ? 'w-8/12 min-h-[500px]' : 'w-160'" class="flex flex-col min-h-60 bg-white border border-black/40 px-7 pb-4 rounded-lg pointer-events-auto shadow-xl relative overflow-scroll">
          <h2 v-if="isUpgrading" class="text-xl font-bold text-slate-800/70 pt-5">
            {{ serverDetails.isInstallingFresh ? 'Installing' : 'Upgrading' }} Your Cloud Machine...
          </h2>
          <h2 v-else class="text-2xl font-bold text-slate-800/70 border-b border-slate-300 pt-6 pb-3 mb-6">
            Upgrade Required
          </h2>

          <div v-if="isUpgrading" class="flex flex-col grow h-full">
            <InstallStatus :isCompact="true" />
          </div>
          <div v-else>
            <p>
              You have been upgraded to Commander version {{ configStore.version }}. This new version requires an upgrade to your cloud machine. Don't worry, we'll take care of all the details. Just click the "Upgrade" button below to begin.
            </p>

            <div class="flex flex-row justify-end gap-4 mt-6 border-t border-slate-300 pt-4">
              <button @click="startUpgrade" class="bg-argon-button border border-argon-button-hover hover:bg-argon-button-hover text-white font-bold inner-button-shadow px-12 py-2 rounded-md cursor-pointer">
                Upgrade My Cloud Machine
              </button>
            </div>
          </div>
        </div>
      </TransitionChild>
    </div>
  </TransitionRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { TransitionChild, TransitionRoot } from '@headlessui/vue';
import BgOverlay from '../components/BgOverlay.vue';
import { useConfigStore } from '../stores/config';
import InstallStatus from '../components/InstallStatus.vue';
import { invoke } from '@tauri-apps/api/core';
import { storeToRefs } from 'pinia';

const isOpen = Vue.ref(true);
const configStore = useConfigStore();
const { serverDetails } = storeToRefs(configStore);

const isUpgrading = Vue.computed(() => {
  return serverDetails.value.isInstalling;
});

async function startUpgrade() {
  await invoke('upgrade_server');
  serverDetails.value.isRequiringUpgrade = false;
  serverDetails.value.isInstalling = true;
}
</script>