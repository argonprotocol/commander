<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
      <div class="text-red-700 mb-6" v-if="errorMessage">{{ errorMessage }}</div>
      <!-- Step 1: Confirmation -->
      <div v-if="lock.status !== 'releaseRequested' && lock.status !== 'vaultCosigned'" class="space-y-6">
        <template v-if="canAfford">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold">Release Bitcoin</h2>
            <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <div class="mb-6">
            <p class="text-gray-700 mb-4">
              You are releasing your {{ numeral(currency.satsToBtc(lock.satoshis)).format('0,0.[00000000]') }} BTC,
              which will remove
              <span class="font-semibold">₳{{ microgonToArgonNm(releasePrice).format('0,0.[000000]') }}</span>
              from your wallet.
            </p>
          </div>

          <!-- Fee Selection -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-3">
              How fast would you like this to operate on the Bitcoin network?
            </label>

            <div class="space-y-3">
              <label
                v-for="rate in feeRates"
                :key="rate.key"
                class="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                :class="selectedFeeRate === rate.key ? 'border-argon-500 bg-argon-50' : 'border-gray-200'"
              >
                <input type="radio" :value="rate.key" v-model="selectedFeeRate" class="sr-only" />
                <div class="flex-1">
                  <div class="flex justify-between items-center">
                    <span class="font-medium">{{ rate.label }}</span>
                    <span class="text-sm text-gray-600">{{ rate.time }}</span>
                  </div>
                  <p class="text-sm text-gray-500">{{ rate.value }} sats/vbyte</p>
                </div>
              </label>
            </div>
          </div>

          <!-- Destination Address -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">Destination Bitcoin Address</label>
            <input
              v-model="destinationAddress"
              type="text"
              placeholder="bc1q..."
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-argon-500 focus:border-transparent"
            />
            <p class="text-xs text-gray-500 mt-1">Where you want to receive your Bitcoin</p>
          </div>

          <button
            @click="sendReleaseRequest"
            :disabled="!canSendRequest || isLoading"
            class="w-full py-3 rounded-lg font-medium transition-all"
            :class="
              canSendRequest && !isLoading
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            "
          >
            <span v-if="isLoading">
              <svg class="inline w-5 h-5 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke-width="4" stroke-linecap="round" class="text-gray-300"></circle>
                <path
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2.93 6.93A8 8 0 0112 20v4c-6.627 0-12-5.373-12-12h4a8 8 0 008 8v4z"
                  fill="currentColor"
                ></path>
              </svg>
              Releasing...
            </span>
            <span v-else>Initiate Release</span>
          </button>
          <ProgressBar
            v-if="isLoading"
            :progress="releaseProgress"
            :has-error="errorMessage != ''"
            class="inline-block w-24 h-4 mr-2"
          />
        </template>
        <template v-else>
          <div class="text-red-700 mb-6">
            You must add ₳{{ microgonToArgonNm(neededMicrogons).format('0,0.[000000]') }} to your wallet to release this
            Bitcoin.
          </div>
          <button @click="$emit('close')" class="w-full py-3 bg-gray-200 hover:bg-gray-300 rounded-lg">Close</button>
        </template>
      </div>

      <!-- Step 2: Processing -->
      <div v-else-if="lock.status === 'releaseRequested'" class="text-center py-8">
        <div class="mb-6">
          <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-blue-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
          </div>

          <h3 class="text-lg font-semibold mb-2">Processing Release</h3>

          <ProgressBar :progress="releaseProgress" :has-error="errorMessage != ''" class="inline-block w-24 h-4 mr-2" />
          <div class="text-left space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                <svg class="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  ></path>
                </svg>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <!-- Show the details of what was requested -->
              <span class="text-sm">
                <strong>Destination:</strong>
                {{ shortenAddress(destinationAddress) }}
              </span>
              <span class="text-sm">
                <strong>Fee rate:</strong>
                {{ selectedFeeRate }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 3: Vault Cosigned -->
      <div v-else-if="lock.status === 'vaultCosigned'" class="text-center py-8">
        <div class="mb-6">
          <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
          </div>

          <h3 class="text-lg font-semibold mb-2">Bitcoin Partially Released</h3>
          <ProgressBar :progress="releaseProgress" :has-error="errorMessage != ''" class="inline-block w-24 h-4 mr-2" />
          <p class="text-sm text-gray-600">
            You must import this raw transaction into your bitcoin wallet to broadcast it to the Bitcoin network.
          </p>

          <div class="flex flex-col mt-4 items-center">
            <div class="flex flex-col w-full max-w-44 items-center">
              <BitcoinQrCode class="w-44 h-44 mb-3" :size="200" :bytes="releasedTxBytes" v-if="releasedTxBytes" />
              <CopyToClipboard :content="releasedTxHex" class="relative mb-3 mr-5 cursor-pointer">
                <span class="opacity-80">
                  {{ abreviateAddress(releasedTxHex, 10) }}
                  <CopyIcon class="w-4 h-4 ml-1 inline-block" />
                </span>
                <template #copied>
                  <div class="absolute top-0 left-0 w-full h-full pointer-events-none">
                    {{ abreviateAddress(releasedTxHex, 10) }}
                    <CopyIcon class="w-4 h-4 ml-1 inline-block" />
                  </div>
                </template>
              </CopyToClipboard>
            </div>
          </div>
        </div>

        <button @click="$emit('close')" class="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { abreviateAddress } from '../lib/Utils';
import { IBitcoinLockRecord } from '../lib/db/BitcoinLocksTable.ts';
import { useBitcoinLocks } from '../stores/bitcoin.ts';
import { useMyVault, useVaults } from '../stores/vaults.ts';
import { useConfig } from '../stores/config.ts';
import CopyIcon from '../assets/copy.svg?component';
import CopyToClipboard from '../components/CopyToClipboard.vue';
import BitcoinQrCode from '../components/BitcoinQrCode.vue';
import BitcoinLocksStore from '../lib/BitcoinLocksStore.ts';
import { createNumeralHelpers } from '../lib/numeral.ts';
import { useCurrency } from '../stores/currency.ts';
import numeral from 'numeral';
import { u8aToHex } from '@argonprotocol/mainchain';
import { useWallets } from '../stores/wallets.ts';
import ProgressBar from '../components/ProgressBar.vue';

const vaults = useVaults();
const myVault = useMyVault();
const bitcoinLocks = useBitcoinLocks();
const config = useConfig();
const currency = useCurrency();
const wallets = useWallets();
const { microgonToArgonNm } = createNumeralHelpers(currency);

const props = defineProps<{
  lock: IBitcoinLockRecord;
}>();

const emit = defineEmits<{
  close: [];
}>();
const feeRates = ref([
  { key: 'fast', label: 'Fast', time: '~10 min', value: 10n },
  { key: 'medium', label: 'Medium', time: '~30 min', value: 5n },
  { key: 'slow', label: 'Slow', time: '~60 min', value: 3n },
]);
const selectedFeeRate = ref('medium');
const destinationAddress = ref('');
const isLoading = ref(false);
const errorMessage = ref('');

const releasePrice = ref(0n);
const releaseProgress = ref(0);
const releasedTxHex = ref('');
const releasedTxBytes = ref<Uint8Array | null>(null);

const canAfford = computed(() => {
  return neededMicrogons.value <= 0n;
});
const neededMicrogons = computed(() => {
  const amountNeeded = releasePrice.value + 25_000n; // 25,000 txfee buffer
  if (wallets.vaultingWallet.availableMicrogons >= amountNeeded) {
    return 0n;
  }
  return wallets.vaultingWallet.availableMicrogons - amountNeeded;
});

const canSendRequest = computed(() => {
  return destinationAddress.value.trim().length > 0 && !isLoading.value;
});

onMounted(async () => {
  await myVault.load();
  await bitcoinLocks.load();
  void cosignReleaseAsNeeded();
  if (props.lock.status !== 'vaultCosigned' && props.lock.status !== 'releaseRequested') {
    const redemptionRate = await vaults.getRedemptionRate(BigInt(props.lock.satoshis));
    if (redemptionRate > props.lock.lockPrice) {
      releasePrice.value = BigInt(props.lock.lockPrice);
    } else {
      releasePrice.value = redemptionRate;
    }
    const latestFeeRates = await BitcoinLocksStore.getFeeRates();
    console.log(latestFeeRates);
    feeRates.value = Object.entries(latestFeeRates).map(([key, rate]) => {
      return {
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
        time: `~${rate.estimatedMinutes} min`,
        value: rate.feeRate,
      };
    });
  }
});

async function cosignReleaseAsNeeded() {
  releaseProgress.value = 50;
  try {
    if (props.lock.status === 'releaseRequested') {
      isLoading.value = true;
      errorMessage.value = '';
      console.log('Cosigning release for lock:', props.lock);
      const vaultXpriv = await myVault.getVaultXpub(config.bitcoinXprivSeed);
      const result = await myVault.cosignRelease({
        argonKeyring: config.vaultingAccount,
        vaultXpriv,
        utxoId: props.lock.utxoId,
        toScriptPubkey: props.lock.releaseToDestinationAddress!,
        bitcoinNetworkFee: props.lock.releaseBitcoinNetworkFee!,
        progressCallback(progress: number) {
          releaseProgress.value = 50 + progress * 0.25;
        },
      });
      if (result) {
        console.log('Cosigned release successfully:', result);
        await bitcoinLocks.updateVaultSignature(props.lock);
      }
    }
  } catch (error) {
    console.error('Failed to cosign release:', error);
    errorMessage.value = `Failed to cosign release. ${error}`;
  } finally {
    isLoading.value = false;
  }
  releaseProgress.value = 75;
  try {
    if (props.lock.status === 'vaultCosigned') {
      isLoading.value = true;
      errorMessage.value = '';

      releasedTxBytes.value = await bitcoinLocks.cosignAndGenerateTxBytes(props.lock, config.bitcoinXprivSeed);
      releasedTxHex.value = u8aToHex(releasedTxBytes.value, undefined, false);
      console.log('Generated PSBT:', releasedTxHex.value);
    }
  } catch (error) {
    console.error('Failed to cosign and generate transaction:', error);
    errorMessage.value = `Failed to finalize bitcoin transaction. ${error}`;
  } finally {
    isLoading.value = false;
  }

  releaseProgress.value = 90;
}

async function sendReleaseRequest() {
  if (!canSendRequest.value) return;

  releaseProgress.value = 0;
  try {
    isLoading.value = true;
    errorMessage.value = '';
    const toScriptPubkey = destinationAddress.value.trim();
    const feeRate = feeRates.value.find(rate => rate.key === selectedFeeRate.value);
    const networkFee = await bitcoinLocks.calculateBitcoinNetworkFee(props.lock, feeRate?.value ?? 5n, toScriptPubkey);
    await bitcoinLocks.requestRelease({
      lock: props.lock,
      bitcoinNetworkFee: networkFee,
      toScriptPubkey,
      argonKeyring: config.vaultingAccount,
      txProgressCallback(progress: number) {
        releaseProgress.value = progress * 0.5; // 0-50% for request, 50-100% for cosign
      },
    });
  } catch (error) {
    console.error('Failed to send release request:', error);
    errorMessage.value = `Failed to send release request. ${error}`;
  } finally {
    isLoading.value = false;
  }
  releaseProgress.value = 50;

  await cosignReleaseAsNeeded();
}

function shortenAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
</script>
