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
    <UpgradeOverlay v-if="isNeedingUpgradeApproval" />
    <ServerConnectOverlay />
    <WalletOverlay />
    <ServerRemoveOverlay />
    <ServerConfigureOverlay />
    <SecuritySettingsOverlay />
    <BiddingRulesOverlay />
    <!-- <ProvisioningCompleteOverlay /> -->
    <SyncingOverlay v-if="config.isServerSyncing && config.isServerUpToDate && !isNeedingUpgradeApproval" />
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

const basicStore = useBasicStore();
const config = useConfig();
const installer = useInstaller();

let timeout: number | undefined;

const isNeedingUpgradeApproval = Vue.computed(() => {
  return config.isWaitingForUpgradeApproval || (config.isServerInstalled && !config.isServerUpToDate);
});

onBeforeMount(async () => {
  await waitForLoad();
});

onMounted(async () => {
  const isReadyToRun = await installer.calculateIsReadyToRun();
  if (isReadyToRun) {
    installer.run();
  }
  timeout = setInterval(() => checkForUpdates(), 60e3) as unknown as number;
});

onBeforeUnmount(() => {
  if (timeout) {
    clearInterval(timeout);
  }
});
</script>
