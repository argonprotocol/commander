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
    <ServerConnectOverlay />
    <BiddingRulesOverlay />
    <WalletOverlay />
    <ServerRemoveOverlay />
    <ServerConfigureOverlay />
    <SecuritySettingsOverlay />
    <ProvisioningCompleteOverlay />
  </div>
</template>

<script setup lang="ts">
import MiningPanel from "./panels/MiningPanel.vue";
import VaultingPanel from "./panels/VaultingPanel.vue";
import LiquidLockingPanel from "./panels/LiquidLockingPanel.vue";
import ServerConnectOverlay from "./overlays/ServerConnectOverlay.vue";
import BiddingRulesOverlay from "./overlays/BiddingRulesOverlay.vue";
import WalletOverlay from "./overlays/WalletOverlay.vue";
import ServerRemoveOverlay from "./overlays/ServerRemoveOverlay.vue";
import ServerConfigureOverlay from "./overlays/ServerConfigureOverlay.vue";
import SecuritySettingsOverlay from "./overlays/SecuritySettingsOverlay.vue";
import ProvisioningCompleteOverlay from "./overlays/ProvisioningCompleteOverlay.vue";
import TopBar from "./components/TopBar.vue";
import { useBasicStore } from "./stores/basic";
import { useConfigStore } from "./stores/config";
import { checkForUpdates } from "./tauri-controls/utils/checkForUpdates.ts";
import { onBeforeUnmount, onMounted } from "vue";

const basicStore = useBasicStore();
const configStore = useConfigStore();

let timeout: number | undefined;
onMounted(() => {
  timeout = setInterval(() => checkForUpdates(), 60000) as unknown as number;
});
onBeforeUnmount(() => {
  if (timeout) {
    clearInterval(timeout);
  }
});
</script>
