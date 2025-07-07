<template>
  <div class="h-screen w-screen flex flex-col">
    <TopBar />
    <main v-if="config.isLoaded" class="flex-grow relative">
      <MiningPanel v-if="controller.panel === 'mining'" />
      <VaultingPanel v-else-if="controller.panel === 'vaulting'" />
      <LiquidLockingPanel v-else-if="controller.panel === 'liquid-locking'" />
    </main>
    <div v-else class="flex-grow relative">
      <div class="flex flex-col items-center justify-center h-full">
        <div class="text-2xl font-bold text-slate-600/40 uppercase">Loading...</div>
      </div>
    </div>
    <ServerBrokenOverlay v-if="stats.isBotBroken" />
    <UpgradeOverlay v-if="isNeedingUpgradeApproval" />
    <ServerConnectOverlay />
    <WalletOverlay />
    <ServerRemoveOverlay />
    <ServerConfigureOverlay />
    <SecuritySettingsOverlay />
    <ConfigureMiningBotOverlay />
    <ConfigureStabilizationVaultOverlay />
    <!-- <ProvisioningCompleteOverlay /> -->
    <SyncingOverlay v-if="stats.isBotSyncing" />
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import MiningPanel from './panels/MiningPanel.vue';
import VaultingPanel from './panels/VaultingPanel.vue';
import LiquidLockingPanel from './panels/LiquidLockingPanel.vue';
import ServerConnectOverlay from './overlays/ServerConnectOverlay.vue';
import ConfigureMiningBotOverlay from './overlays/ConfigureMiningBotOverlay.vue';
import ConfigureStabilizationVaultOverlay from './overlays/ConfigureStabilizationVaultOverlay.vue';
import WalletOverlay from './overlays/WalletOverlay.vue';
import ServerRemoveOverlay from './overlays/ServerRemoveOverlay.vue';
import ServerConfigureOverlay from './overlays/ServerConfigureOverlay.vue';
import SecuritySettingsOverlay from './overlays/SecuritySettingsOverlay.vue';
import ProvisioningCompleteOverlay from './overlays/ProvisioningCompleteOverlay.vue';
import UpgradeOverlay from './overlays/UpgradeOverlay.vue';
import SyncingOverlay from './overlays/SyncingOverlay.vue';
import ServerBrokenOverlay from './overlays/ServerBrokenOverlay.vue';
import TopBar from './components/TopBar.vue';
import { useController } from './stores/controller';
import { useConfig } from './stores/config';
import { useStats } from './stores/stats';
import { checkForUpdates } from './tauri-controls/utils/checkForUpdates.ts';
import { onBeforeMount, onBeforeUnmount, onMounted } from 'vue';
import { waitForLoad } from '@argonprotocol/mainchain';

const controller = useController();
const config = useConfig();
const stats = useStats();

let timeout: number | undefined;

const isNeedingUpgradeApproval = Vue.computed(() => {
  return config.isWaitingForUpgradeApproval || (config.isServerInstalled && !config.isServerUpToDate);
});

onBeforeMount(async () => {
  await waitForLoad();
});

onMounted(async () => {
  timeout = setInterval(() => checkForUpdates(), 60e3) as unknown as number;
});

onBeforeUnmount(() => {
  if (timeout) {
    clearInterval(timeout);
  }
});
</script>
