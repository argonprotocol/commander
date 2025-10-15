<!-- prettier-ignore -->
<template>
  <div :class="errorMessage != '' ? 'pt-16' : 'pt-20'" class="Panel VaultIsInstalling flex flex-col px-[15%] h-full w-full pb-16">
    <h1 class="text-4xl font-bold">Initializing Your Vault</h1>

    <p v-if="errorMessage != ''" class="pt-3 font-light">
      There was an error setting up your vault: <span class="text-red-700">{{ errorMessage }}</span>
    </p>
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
import { onMounted, ref, toRaw } from 'vue';
import { useConfig } from '../../stores/config';
import { useMyVault } from '../../stores/vaults.ts';
import ProgressBar from '../../components/ProgressBar.vue';
import { DEFAULT_MASTER_XPUB_PATH } from '../../lib/MyVault.ts';

const config = useConfig();
const vault = useMyVault();

const createStep = ref(0);

const errorMessage = ref('');
onMounted(async () => {
  await vault.load();
  if (vault.createdVault) {
    console.log('Vault already created, skipping installation.');
    return;
  }

  const masterXpubPath = DEFAULT_MASTER_XPUB_PATH;
  console.log('Loading installing page', config.vaultingAccount.address);
  try {
    await vault.create({
      argonKeyring: toRaw(config.vaultingAccount),
      rules: config.vaultingRules,
      masterXpubPath,
      xprivSeed: toRaw(config.bitcoinXprivSeed),
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
