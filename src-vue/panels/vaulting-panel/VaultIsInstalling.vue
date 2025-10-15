<!-- prettier-ignore -->
<template>
  <div :class="errorMessage != '' ? 'pt-16' : 'pt-20'" class="Panel VaultIsInstalling flex flex-col px-[15%] h-full w-full pb-16">
    <h1 class="text-4xl font-bold">Initializing Your Vault</h1>

    <p v-if="errorMessage != ''" class="pt-3 font-light">
      There was an error setting up your vault: <span class="text-red-700">{{ errorMessage }}</span>
    </p>

    <div v-if="isUpdatingVault || updateVaultErrorMessage" class="px-6 py-2 text-md font-thin text-center w-full h-full">
      <span v-if="updateVaultErrorMessage" class="text-red-700 font-bold text-md">{{ updateVaultErrorMessage }}</span>
      <div v-else class="flex flex-row items-center text-gray-500 w-full whitespace-nowrap">
        <span class="mr-2">Updating Vault</span>
        <ProgressBar
          :hasError="updateVaultErrorMessage != ''"
          :progress="updateVaultProgressPct"
        />
      </div>
    </div>

    <p v-else class="pt-3 pb-2 font-light">
      We are setting up your vault.
    </p>

    <div class="flex flex-col">
      <ProgressBar
        :hasError="errorMessage != ''"
        :progress="createStep"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useConfig } from '../../stores/config';
import { useMyVault } from '../../stores/vaults.ts';
import ProgressBar from '../../components/ProgressBar.vue';
import { DEFAULT_MASTER_XPUB_PATH } from '../../lib/MyVault.ts';
import { useBitcoinLocks } from '../../stores/bitcoin.ts';

const config = useConfig();
const vault = useMyVault();
const bitcoinLocks = useBitcoinLocks();

const createStep = Vue.ref(0);

const errorMessage = Vue.ref('');

const vaultingRules = config.vaultingRules;
const isUpdatingVault = Vue.ref(false);
const updateVaultErrorMessage = Vue.ref('');
const updateVaultProgressPct = Vue.ref(0); // 0-100

async function createSecuritization() {
  await bitcoinLocks.load();

  try {
    updateVaultErrorMessage.value = '';
    await vault.saveVaultRules({
      argonKeyring: config.vaultingAccount,
      bitcoinLocksStore: bitcoinLocks,
      bip39Seed: config.bitcoinXprivSeed,
      rules: vaultingRules,
      txProgressCallback(progress: number) {
        if (progress > 0) {
          isUpdatingVault.value = true;
        }
        updateVaultProgressPct.value = progress;
      },
    });
    updateVaultProgressPct.value = 100;
    if (isUpdatingVault.value) {
      setTimeout(() => (isUpdatingVault.value = false), 60000);
    }
  } catch (error) {
    console.error('Error prebonding treasury pool:', error);
    updateVaultErrorMessage.value = error instanceof Error ? error.message : `${error}`;
    updateVaultProgressPct.value = 100;
  }
}

Vue.onMounted(async () => {
  await vault.load();

  if (vault.createdVault) {
    console.log('Vault already created, skipping installation.');
    return;
  }

  const masterXpubPath = DEFAULT_MASTER_XPUB_PATH;
  console.log('Loading installing page', config.vaultingAccount.address);
  try {
    await vault.create({
      argonKeyring: Vue.toRaw(config.vaultingAccount),
      rules: config.vaultingRules,
      masterXpubPath,
      xprivSeed: Vue.toRaw(config.bitcoinXprivSeed),
      progressCallback(progress: number, message) {
        console.log(`Vault creation progress: Step ${progress} - ${message}`);
        createStep.value = progress * 100;
      },
    });
  } catch (error: any) {
    console.error('Error creating vault:', error);
    errorMessage.value = error.message || 'Unknown error occurred while creating vault.';
  }
});
</script>
