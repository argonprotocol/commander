<template>
  <div class="h-screen w-screen flex flex-col">
    <TopBar />
    <main class="flex-grow relative">
      <MiningPanel v-if="basicStore.panel === 'mining'" />
      <VaultingPanel v-else-if="basicStore.panel === 'vaulting'" />
      <LiquidLockingPanel v-else-if="basicStore.panel === 'liquid-locking'" />
      
    </main>
    <ConnectCloudOverlay />
    <BiddingRulesOverlay />
    <WalletOverlay />
  </div>
</template>

<script setup lang="ts">
import MiningPanel from "./panels/MiningPanel.vue";
import VaultingPanel from "./panels/VaultingPanel.vue";
import LiquidLockingPanel from "./panels/LiquidLockingPanel.vue";
import ConnectCloudOverlay from "./overlays/ConnectCloudOverlay.vue";
import BiddingRulesOverlay from "./overlays/BiddingRulesOverlay.vue";
import WalletOverlay from "./overlays/WalletOverlay.vue";
import TopBar from "./components/TopBar.vue";
import { useBasicStore } from './stores/basic';

const basicStore = useBasicStore();
</script>

<style scoped>

</style>