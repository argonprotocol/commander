<template>
  <div class="h-screen w-screen flex flex-col">
    <TopBar />
    <main v-if="config.isLoaded" class="flex-grow relative">
      <MiningPanel v-if="basicStore.panel === 'mining'" />
      <VaultingPanel v-else-if="basicStore.panel === 'vaulting'" />
      <LiquidLockingPanel v-else-if="basicStore.panel === 'liquid-locking'" />
    </main>
    <div v-else class="flex-grow relative">
      <div class="flex flex-col items-center justify-center h-full">
        <div class="text-2xl font-bold text-slate-600/40 uppercase">Loading...</div>
      </div>
    </div>
    <UpgradeOverlay v-if="shouldShowUpgradeOverlay" />
    <ServerConnectOverlay />
    <WalletOverlay />
    <ServerRemoveOverlay />
    <ServerConfigureOverlay />
    <SecuritySettingsOverlay />
    <BiddingRulesOverlay />
    <!-- <ProvisioningCompleteOverlay /> -->
    <SyncingOverlay
      v-if="config.isServerSyncing && !config.isServerInstalling && !isWaitingForUpgradeApproval"
    />
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
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
import { useConfig } from './stores/config';
import { useInstaller } from './stores/installer';
import { checkForUpdates } from './tauri-controls/utils/checkForUpdates.ts';
import { onBeforeMount, onBeforeUnmount, onMounted } from 'vue';
import { waitForLoad } from '@argonprotocol/mainchain';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';

const basicStore = useBasicStore();
const config = useConfig();
const installer = useInstaller();

let timeout: number | undefined;

const shouldShowUpgradeOverlay = Vue.computed(() => {
  return config.isWaitingForUpgradeApproval || (config.isServerInstalling && !config.isServerNew);
});

onBeforeMount(async () => {
  await waitForLoad();
});

onMounted(async () => {
  installer.tryToRun();
  timeout = setInterval(() => checkForUpdates(), 60e3) as unknown as number;
});

onBeforeUnmount(() => {
  if (timeout) {
    clearInterval(timeout);
  }
});
</script>
