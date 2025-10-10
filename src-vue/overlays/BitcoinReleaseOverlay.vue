<template>
  <DialogRoot class="absolute inset-0 z-10" :open="true">
    <DialogPortal>
      <AnimatePresence>
        <DialogOverlay asChild>
          <Motion asChild :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0 }">
            <BgOverlay @close="closeOverlay" />
          </Motion>
        </DialogOverlay>

        <DialogContent asChild @escapeKeyDown="closeOverlay" :aria-describedby="undefined">
          <Motion
            :ref="draggable.setModalRef"
            @mousedown="draggable.onMouseDown($event)"
            :initial="{ opacity: 0 }"
            :animate="{ opacity: 1 }"
            :exit="{ opacity: 0 }"
            :style="{
              top: `calc(50% + ${draggable.modalPosition.y}px)`,
              left: `calc(50% + ${draggable.modalPosition.x}px)`,
              transform: 'translate(-50%, -50%)',
              cursor: draggable.isDragging ? 'grabbing' : 'default',
            }"
            class="text-md absolute z-50 w-200 overflow-scroll rounded-lg border border-black/40 bg-white px-4 pt-2 pb-4 shadow-xl focus:outline-none">
            <h2
              @mousedown="draggable.onMouseDown($event)"
              :style="{ cursor: draggable.isDragging ? 'grabbing' : 'grab' }"
              class="mb-2 flex w-full flex-row items-center space-x-4 border-b border-black/20 px-3 pt-3 pb-3 text-5xl font-bold">
              <DialogTitle class="grow text-2xl font-bold">Release Bitcoin</DialogTitle>
              <div
                @click="closeOverlay"
                class="z-10 mr-1 flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-md border border-slate-400/60 text-sm/6 font-semibold hover:border-slate-500/60 hover:bg-[#f1f3f7] focus:outline-none">
                <XMarkIcon class="h-5 w-5 stroke-4 text-[#B74CBA]" />
              </div>
            </h2>

            <div class="mb-6 text-red-700" v-if="errorMessage">{{ errorMessage }}</div>
            <!-- Step 1: Confirmation -->
            <div v-if="lock.status !== 'vaultCosigned'" class="flex flex-col space-y-6 px-3 pt-3">
              <template v-if="canAfford">
                <div class="mb-6">
                  <p class="mb-4 text-gray-700">
                    You are releasing
                    <strong>
                      {{ numeral(currency.satsToBtc(lock.satoshis)).format('0,0.[00000000]') }} of Bitcoin
                    </strong>
                    , which requires
                    <strong>{{ microgonToArgonNm(releasePrice).format('0,0.[000000]') }} in Argons</strong>
                    . This will be pulled directly from the available funds in your vaulting wallet.
                  </p>
                </div>

                <!-- Fee Selection -->
                <div class="mb-6">
                  <label class="mb-3 block text-sm font-medium text-gray-700">
                    How fast would you like this to operate on the Bitcoin network?
                  </label>

                  <div class="space-y-3">
                    <label
                      v-for="rate in feeRates"
                      :key="rate.key"
                      class="flex cursor-pointer items-center rounded-lg border p-3 hover:bg-gray-50"
                      :class="selectedFeeRate === rate.key ? 'border-argon-500 bg-argon-50' : 'border-gray-200'">
                      <input type="radio" :value="rate.key" v-model="selectedFeeRate" class="sr-only" />
                      <div class="flex-1">
                        <div class="flex items-center justify-between">
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
                  <label class="mb-2 block text-sm font-medium text-gray-700">Destination Bitcoin Address</label>
                  <input
                    v-model="destinationAddress"
                    type="text"
                    placeholder="bc1q..."
                    class="focus:ring-argon-500 w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-transparent focus:ring-2" />
                  <p class="mt-1 text-xs text-gray-500">Where you want to receive your Bitcoin</p>
                </div>

                <button
                  @click="sendReleaseRequest"
                  :disabled="!canSendRequest || isLoading"
                  class="w-full rounded-lg py-3 font-medium transition-all"
                  :class="
                    canSendRequest && !isLoading
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'cursor-not-allowed bg-gray-200 text-gray-400'
                  ">
                  <span v-if="isLoading">
                    <svg class="mr-2 inline h-5 w-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke-width="4"
                        stroke-linecap="round"
                        class="text-gray-300"></circle>
                      <path
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2.93 6.93A8 8 0 0112 20v4c-6.627 0-12-5.373-12-12h4a8 8 0 008 8v4z"
                        fill="currentColor"></path>
                    </svg>
                    Releasing...
                  </span>
                  <span v-else>Initiate Release</span>
                </button>
                <ProgressBar
                  v-if="isLoading"
                  :progress="releaseProgress"
                  :has-error="errorMessage != ''"
                  class="mr-2 inline-block h-4 w-24" />
              </template>
              <template v-else>
                <div class="mb-6 text-red-700">
                  You must add ₳{{ microgonToArgonNm(neededMicrogons).format('0,0.[000000]') }} to your wallet to
                  release this Bitcoin.
                </div>
                <button @click="$emit('close')" class="w-full rounded-lg bg-gray-200 py-3 hover:bg-gray-300">
                  Close
                </button>
              </template>
            </div>
            <div v-else class="py-8 text-center">
              <div class="mb-6">
                <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <svg class="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>

                <h3 class="mb-2 text-lg font-semibold">Bitcoin Partially Released</h3>
                <ProgressBar
                  :progress="releaseProgress"
                  :has-error="errorMessage != ''"
                  class="mr-2 inline-block h-4 w-24" />
                <p class="text-sm text-gray-600">
                  You must import this raw transaction into your bitcoin wallet to broadcast it to the Bitcoin network.
                </p>

                <div class="mt-4 flex flex-col items-center">
                  <div class="flex w-full max-w-44 flex-col items-center">
                    <BitcoinQrCode class="mb-3 h-44 w-44" :size="200" :bytes="releasedTxBytes" v-if="releasedTxBytes" />
                    <CopyToClipboard :content="releasedTxHex" class="relative mr-5 mb-3 cursor-pointer">
                      <span class="opacity-80">
                        {{ abbreviateAddress(releasedTxHex, 10) }}
                        <CopyIcon class="ml-1 inline-block h-4 w-4" />
                      </span>
                      <template #copied>
                        <div class="pointer-events-none absolute top-0 left-0 h-full w-full">
                          {{ abbreviateAddress(releasedTxHex, 10) }}
                          <CopyIcon class="ml-1 inline-block h-4 w-4" />
                        </div>
                      </template>
                    </CopyToClipboard>
                  </div>
                </div>
              </div>

              <button @click="$emit('close')" class="rounded-lg bg-gray-200 px-6 py-2 hover:bg-gray-300">Close</button>
            </div>
          </Motion>
        </DialogContent>
      </AnimatePresence>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { computed, onMounted, ref, onUnmounted } from 'vue';
import { abbreviateAddress } from '../lib/Utils';
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
import Draggable from './helpers/Draggable';
import BgOverlay from '../components/BgOverlay.vue';
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, DialogClose } from 'reka-ui';
import { AnimatePresence, Motion } from 'motion-v';
import { XMarkIcon } from '@heroicons/vue/24/outline';

const vaults = useVaults();
const myVault = useMyVault();
const bitcoinLocks = useBitcoinLocks();
const config = useConfig();
const currency = useCurrency();
const wallets = useWallets();
const { microgonToArgonNm } = createNumeralHelpers(currency);

const draggable = Vue.reactive(new Draggable());

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

function closeOverlay() {
  console.log('Closing overlay');
  emit('close');
}

onMounted(async () => {
  await myVault.load();
  await bitcoinLocks.load();
  void cosignReleaseAsNeeded();
  if (props.lock.status !== 'vaultCosigned' && props.lock.status !== 'releaseRequested') {
    const redemptionRate = await vaults.getRedemptionRate(BigInt(props.lock.satoshis));
    if (redemptionRate > props.lock.liquidityPromised) {
      releasePrice.value = BigInt(props.lock.liquidityPromised);
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

  if (props.lock.status === 'vaultCosigned') {
    await checkReleaseStatus();
  }
});

let waitForReleasedUtxoId: string | null = null;
let releasedUtxoCheckInterval: ReturnType<typeof setInterval> | null = null;
async function checkReleaseStatus() {
  const utxo = props.lock;
  console.log(utxo.status, waitForReleasedUtxoId);
  if (!waitForReleasedUtxoId) return;
  if (utxo.status === 'vaultCosigned') {
    const status = await bitcoinLocks.checkTxidStatus(utxo, waitForReleasedUtxoId);
    if (status.isConfirmed) {
      if (releasedUtxoCheckInterval) clearInterval(releasedUtxoCheckInterval);
      emit('close');
    }
  }
}

onUnmounted(() => {
  if (releasedUtxoCheckInterval) {
    clearInterval(releasedUtxoCheckInterval);
  }
  waitForReleasedUtxoId = null;
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
          if (props.lock.status === 'releaseRequested') {
            releaseProgress.value = 50 + progress * 0.25;
          }
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

      const { txid, bytes } = await bitcoinLocks.cosignAndGenerateTxBytes(props.lock, config.bitcoinXprivSeed);
      releasedTxBytes.value = bytes;
      waitForReleasedUtxoId = txid;
      releasedTxHex.value = u8aToHex(releasedTxBytes.value, undefined, false);
      console.log('Generated PSBT:', releasedTxHex.value);
      releasedUtxoCheckInterval = setInterval(checkReleaseStatus, 5000);
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
        if (props.lock.status === 'releaseRequested') {
          releaseProgress.value = progress * 0.5; // 0-50% for request, 50-100% for cosign
        }
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
