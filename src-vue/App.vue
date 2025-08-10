<!-- prettier-ignore -->
<template>
  <div class="h-screen w-screen flex flex-col overflow-hidden cursor-default">
    <TopBar />
    <main v-if="controller.isLoaded && !controller.isImporting" class="flex-grow relative">
      <MiningPanel v-if="showMiningPanel" />
      <VaultingPanel v-else-if="controller.panel === 'vaulting'" />
      <LiquidLockingPanel v-else-if="controller.panel === 'liquid-locking'" />
    </main>
    <div v-else class="flex-grow relative">
      <div class="flex flex-col items-center justify-center h-full">
        <div class="text-2xl font-bold text-slate-600/40 uppercase">Loading...</div>
      </div>
    </div>
    <template v-if="config.isLoaded">
      <template v-if="showMiningPanel">
        <UpgradeOverlay v-if="isNeedingUpgrade" />
        <ServerBrokenOverlay v-else-if="bot.isBroken" />
        <SyncingOverlay v-else-if="bot.isSyncing" />
      </template>
      <ServerConnectOverlay />
      <WalletOverlay />
      <ServerRemoveOverlay />
      <ServerConfigureOverlay />
      <SecuritySettingsOverlay />
      <BotOverlay />
      <ConfigureStabilizationVaultOverlay />
      <!-- <ProvisioningCompleteOverlay /> -->
      <TooltipOverlay />
      <AboutOverlay />
      <ComplianceOverlay />
    </template>
    <TroubleshootingOverlay />
    <ImportingOverlay />
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import MiningPanel from './panels/MiningPanel.vue';
import VaultingPanel from './panels/VaultingPanel.vue';
import LiquidLockingPanel from './panels/LiquidLockingPanel.vue';
import ServerConnectOverlay from './overlays/ServerConnectOverlay.vue';
import BotOverlay from './overlays/BotOverlay.vue';
import ConfigureStabilizationVaultOverlay from './overlays/ConfigureStabilizationVaultOverlay.vue';
import WalletOverlay from './overlays/WalletOverlay.vue';
import ServerRemoveOverlay from './overlays/ServerRemoveOverlay.vue';
import ServerConfigureOverlay from './overlays/ServerConfigureOverlay.vue';
import SecuritySettingsOverlay from './overlays/SecuritySettingsOverlay.vue';
import ProvisioningCompleteOverlay from './overlays/ProvisioningCompleteOverlay.vue';
import UpgradeOverlay from './overlays/UpgradeOverlay.vue';
import SyncingOverlay from './overlays/SyncingOverlay.vue';
import ServerBrokenOverlay from './overlays/ServerBrokenOverlay.vue';
import TopBar from './navigation/TopBar.vue';
import { useController } from './stores/controller';
import { useConfig } from './stores/config';
import { useBot } from './stores/bot';
import { checkForUpdates } from './tauri-controls/utils/checkForUpdates.ts';
import { waitForLoad } from '@argonprotocol/mainchain';
import TooltipOverlay from './overlays/TooltipOverlay.vue';
import { hideTooltip } from './lib/TooltipUtils';
import AboutOverlay from './overlays/AboutOverlay.vue';
import ComplianceOverlay from './overlays/ComplianceOverlay.vue';
import TroubleshootingOverlay from './overlays/Troubleshooting.vue';
import { listen } from '@tauri-apps/api/event';
import basicEmitter from './emitters/basicEmitter';
import ImportingOverlay from './overlays/ImportingOverlay.vue';

const controller = useController();
const config = useConfig();
const bot = useBot();

let timeout: number | undefined;

const isNeedingUpgrade = Vue.computed(() => {
  return config.isWaitingForUpgradeApproval || (config.isServerInstalled && !config.isServerUpToDate);
});

const showMiningPanel = Vue.computed(() => {
  return controller.panel === 'mining';
});

function clickHandler() {
  hideTooltip();
}

// Listen for Tauri events from the backend
listen('openAboutOverlay', () => {
  basicEmitter.emit('openAboutOverlay');
});

listen('openMiningDashboard', () => {
  controller.setPanel('mining');
});

listen('openVaultingDashboard', () => {
  controller.setPanel('vaulting');
});

listen('openConfigureMiningBot', () => {
  basicEmitter.emit('openBotOverlay');
});

listen('openConfigureVaultSettings', () => {
  basicEmitter.emit('openConfigureStabilizationVaultOverlay');
});

listen('openMiningWalletOverlay', event => {
  basicEmitter.emit('openWalletOverlay', { walletId: 'mining', screen: 'receive' });
});

listen('openVaultingWalletOverlay', event => {
  basicEmitter.emit('openWalletOverlay', { walletId: 'vaulting', screen: 'receive' });
});

listen('openSecuritySettings', () => {
  basicEmitter.emit('openSecuritySettingsOverlay');
});

listen('openJurisdictionalCompliance', () => {
  basicEmitter.emit('openComplianceOverlay');
});

listen('openTroubleshootingOverlay', (event: any) => {
  basicEmitter.emit('openTroubleshootingOverlay', {
    screen: event.payload as 'server-diagnostics' | 'data-and-log-files' | 'options-for-restart',
  });
});

Vue.onBeforeMount(async () => {
  await waitForLoad();
});

Vue.onMounted(async () => {
  timeout = setInterval(() => checkForUpdates(), 60e3) as unknown as number;
  // Use capture phase to ensure this handler runs before other handlers
  document.addEventListener('click', clickHandler, true);
  hideTooltip();
});

Vue.onBeforeUnmount(() => {
  if (timeout) {
    clearInterval(timeout);
  }
  document.removeEventListener('click', clickHandler, true);
});

Vue.onErrorCaptured((error, instance) => {
  console.error(instance?.$options.name, error);
  return false;
});
</script>
