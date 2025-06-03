<template>
  <div class="h-screen w-screen flex flex-col">
    <TopBar />
    <main v-if="configStore.isLoaded" class="flex-grow relative">
      <MiningPanel v-if="basicStore.panel === 'mining'" />
      <VaultingPanel v-else-if="basicStore.panel === 'vaulting'" />
      <LiquidLockingPanel v-else-if="basicStore.panel === 'liquid-locking'" />
    </main>
    <div v-else class="flex-grow relative">
      <div class="flex flex-col items-center justify-center h-full">
        <div class="text-2xl font-bold text-slate-600/40 uppercase">
          Loading...
        </div>
      </div>
    </div>
    <UpgradeOverlay v-if="isRequiringUpgrade" />
    <ServerConnectOverlay />
    <BiddingRulesOverlay />
    <WalletOverlay />
    <ServerRemoveOverlay />
    <ServerConfigureOverlay />
    <SecuritySettingsOverlay />
    <ProvisioningCompleteOverlay />
    <SyncingOverlay v-if="stats.isSyncing && !configStore.serverDetails.isInstalling && !configStore.serverDetails.isRequiringUpgrade" />
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { storeToRefs } from 'pinia';
import MiningPanel from './panels/MiningPanel.vue';
import VaultingPanel from './panels/VaultingPanel.vue';
import LiquidLockingPanel from './panels/LiquidLockingPanel.vue';
import ServerConnectOverlay from './overlays/ServerConnectOverlay.vue';
import BiddingRulesOverlay from './overlays/BiddingRulesOverlay.vue';
import WalletOverlay from './overlays/WalletOverlay.vue';
import ServerRemoveOverlay from './overlays/ServerRemoveOverlay.vue';
import ServerConfigureOverlay from './overlays/ServerConfigureOverlay.vue';
import SecuritySettingsOverlay from './overlays/SecuritySettingsOverlay.vue';
import ProvisioningCompleteOverlay from './overlays/ProvisioningCompleteOverlay.vue';
import UpgradeOverlay from './overlays/UpgradeOverlay.vue';
import SyncingOverlay from './overlays/SyncingOverlay.vue';
import TopBar from './components/TopBar.vue';
import { useBasicStore } from './stores/basic';
import { useConfigStore } from './stores/config';
import { checkForUpdates } from './tauri-controls/utils/checkForUpdates.ts';
import { onBeforeMount, onBeforeUnmount, onMounted } from 'vue';
import { waitForLoad } from '@argonprotocol/mainchain';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';

const basicStore = useBasicStore();
const configStore = useConfigStore();
const { stats } = storeToRefs(configStore);

let timeout: number | undefined;

const isRequiringUpgrade = Vue.computed(() => {
  return configStore.serverDetails.isRequiringUpgrade || 
    (configStore.serverDetails.isInstalling && !configStore.serverDetails.isNewServer);
});

onBeforeMount(async () => {
  // need to wait for crypto to load
  await waitForLoad();
});

onMounted(async () => {
  const currentVersion = await getVersion();
  const storedVersion = localStorage.getItem('lastVersion');

  if (storedVersion !== currentVersion) {
    console.log(`App updated applied ${currentVersion}`);
    localStorage.setItem('lastVersion', currentVersion);
    void invoke('upgrade_server');
  }

  timeout = setInterval(() => checkForUpdates(), 60e3) as unknown as number;
});

onBeforeUnmount(() => {
  if (timeout) {
    clearInterval(timeout);
  }
});
</script>
