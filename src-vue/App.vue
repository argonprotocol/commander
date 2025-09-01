<!-- prettier-ignore -->
<template>
  <div class="h-screen w-screen flex flex-col overflow-hidden cursor-default">
    <TopBar />
    <main v-if="controller.isLoaded && !controller.isImporting" class="flex-grow relative">
      <AlertBars />
      <MiningPanel v-if="showMiningPanel" />
      <VaultingPanel v-else-if="controller.panelKey === PanelKey.Vaulting" />
    </main>
    <div v-else class="flex-grow relative">
      <div class="flex flex-col items-center justify-center h-full">
        <div class="text-2xl font-bold text-slate-600/40 uppercase">Loading...</div>
      </div>
    </div>
    <template v-if="config.isLoaded">
      <template v-if="showMiningPanel">
        <UpgradeOverlay v-if="isNeedingUpgrade && config.isMinerReadyToInstall" />
        <ServerBrokenOverlay v-else-if="bot.isBroken" />
        <SyncingOverlay v-else-if="bot.isSyncing" />
        <BootingOverlay v-else-if="config.isBootingUpFromMiningAccountPreviousHistory" />
      </template>
      <ServerConnectOverlay />
      <WalletOverlay />
      <ServerRemoveOverlay />
      <ServerConfigureOverlay />
      <SecuritySettingsOverlay />
      <BotOverlay />
      <VaultOverlay />
      <!-- <ProvisioningCompleteOverlay /> -->
      <TooltipOverlay />
      <AboutOverlay />
      <ComplianceOverlay />
      <WelcomeTour v-if="tour.currentStep" />
      <WelcomeOverlay v-else-if="config.showWelcomeOverlay" />
    </template>
    <TroubleshootingOverlay />
    <ImportingOverlay />
    <AppUpdatesOverlay />
    <HowMiningWorksOverlay />
    <HowVaultingWorksOverlay />
  </div>
</template>

<script setup lang="ts">
import './lib/Env.ts'; // load env first
import * as Vue from 'vue';
import menuStart from './menuStart.ts';
import MiningPanel from './panels/MiningPanel.vue';
import VaultingPanel from './panels/VaultingPanel.vue';
import ServerConnectOverlay from './overlays/ServerConnectOverlay.vue';
import BotOverlay from './overlays/BotOverlay.vue';
import VaultOverlay from './overlays/VaultOverlay.vue';
import WalletOverlay from './overlays/WalletOverlay.vue';
import ServerRemoveOverlay from './overlays/ServerRemoveOverlay.vue';
import ServerConfigureOverlay from './overlays/ServerConfigureOverlay.vue';
import SecuritySettingsOverlay from './overlays/SecuritySettingsOverlay.vue';
import UpgradeOverlay from './overlays/UpgradeOverlay.vue';
import SyncingOverlay from './overlays/SyncingOverlay.vue';
import ServerBrokenOverlay from './overlays/ServerBrokenOverlay.vue';
import TopBar from './navigation/TopBar.vue';
import { useController } from './stores/controller';
import { useConfig } from './stores/config';
import { useTour } from './stores/tour';
import { useBot } from './stores/bot';
import { waitForLoad } from '@argonprotocol/mainchain';
import TooltipOverlay from './overlays/TooltipOverlay.vue';
import { hideTooltip } from './lib/TooltipUtils';
import AboutOverlay from './overlays/AboutOverlay.vue';
import ComplianceOverlay from './overlays/ComplianceOverlay.vue';
import TroubleshootingOverlay from './overlays/Troubleshooting.vue';
import ImportingOverlay from './overlays/ImportingOverlay.vue';
import BootingOverlay from './overlays/BootingOverlay.vue';
import AppUpdatesOverlay from './overlays/AppUpdatesOverlay.vue';
import AlertBars from './navigation/AlertBars.vue';
import HowMiningWorksOverlay from './overlays/bot/HowMiningWorks.vue';
import HowVaultingWorksOverlay from './overlays/vault/HowVaultingWorks.vue';
import { PanelKey } from './interfaces/IConfig.ts';
import WelcomeOverlay from './overlays/WelcomeOverlay.vue';
import WelcomeTour from './overlays/WelcomeTour.vue';

const controller = useController();
const config = useConfig();
const tour = useTour();
const bot = useBot();

const isNeedingUpgrade = Vue.computed(() => {
  return config.isMinerWaitingForUpgradeApproval || (config.isMinerInstalled && !config.isMinerUpToDate);
});

const showMiningPanel = Vue.computed(() => {
  return controller.panelKey === PanelKey.Mining;
});

function clickHandler() {
  hideTooltip();
}

function keydownHandler(event: KeyboardEvent) {
  // Check for CMD+Shift+[ (mining panel)
  if (event.metaKey && event.shiftKey && event.key === '[') {
    event.preventDefault();
    controller.setPanelKey(PanelKey.Mining);
  }
  // Check for CMD+Shift+] (vaulting panel)
  else if (event.metaKey && event.shiftKey && event.key === ']') {
    event.preventDefault();
    controller.setPanelKey(PanelKey.Vaulting);
  }
}

Vue.onBeforeMount(async () => {
  await waitForLoad();
});

Vue.onMounted(async () => {
  // Use capture phase to ensure this handler runs before other handlers
  document.addEventListener('click', clickHandler, true);
  hideTooltip();

  // Add keyboard shortcuts for panel switching
  document.addEventListener('keydown', keydownHandler);
});

Vue.onBeforeUnmount(() => {
  document.removeEventListener('click', clickHandler, true);
  document.removeEventListener('keydown', keydownHandler);
});

Vue.onErrorCaptured((error, instance) => {
  console.error(instance?.$options.name, error);
  return false;
});

menuStart();
</script>
