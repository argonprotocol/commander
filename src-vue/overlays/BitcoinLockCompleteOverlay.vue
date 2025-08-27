<template>
  <div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
    <div class="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6">
      <div class="mb-6 flex items-center justify-between">
        <h2 class="text-2xl font-bold">Complete Bitcoin Lock</h2>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="py-8 text-center">
        <div class="mb-6">
          <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg class="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h3 class="mb-2 text-lg font-semibold">Send your BTC to the Cosign Address</h3>
          <p class="mb-4 text-gray-600 select-text">
            You must send {{ formattedSatoshis }}
            <select v-model="amountUnit" class="rounded border-l border-gray-300 bg-gray-100">
              <option value="BTC">BTC</option>
              <option value="sats">sats</option>
            </select>
            to:
          </p>

          <div class="mb-4 rounded-lg bg-gray-100 p-4">
            <CopyToClipboard :content="scriptPaytoAddress" class="relative mr-5 mb-3 cursor-pointer">
              <span class="opacity-80">
                {{ abbreviateAddress(scriptPaytoAddress, 10) }}
                <CopyIcon class="ml-1 inline-block h-4 w-4" />
              </span>
              <template #copied>
                <div class="pointer-events-none absolute top-0 left-0 h-full w-full">
                  {{ abbreviateAddress(scriptPaytoAddress, 10) }}
                  <CopyIcon class="ml-1 inline-block h-4 w-4" />
                </div>
              </template>
            </CopyToClipboard>
          </div>

          <div class="mb-4 flex flex-col items-center text-sm text-gray-500">
            <p>You can scan the QR code below in many Bitcoin wallets to fund your lock.</p>
            <BitcoinQrCode class="mb-3 h-44 w-44 text-center" :bip21="fundingBip21" v-if="fundingBip21" />
            <CopyToClipboard :content="fundingBip21" class="relative mr-5 mb-3 cursor-pointer">
              <span class="opacity-80">
                {{ abbreviateAddress(fundingBip21, 10) }}
                <CopyIcon class="ml-1 inline-block h-4 w-4" />
              </span>
              <template #copied>
                <div class="pointer-events-none absolute top-0 left-0 h-full w-full">
                  {{ abbreviateAddress(fundingBip21, 10) }}
                  <CopyIcon class="ml-1 inline-block h-4 w-4" />
                </div>
              </template>
            </CopyToClipboard>
          </div>
        </div>

        <button @click="$emit('close')" class="rounded-lg bg-gray-200 px-6 py-2 hover:bg-gray-300">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { abbreviateAddress } from '../lib/Utils';
import { useCurrency } from '../stores/currency.ts';
import { SATS_PER_BTC } from '@argonprotocol/mainchain';
import { useBitcoinLocks } from '../stores/bitcoin.ts';
import { IBitcoinLockRecord } from '../lib/db/BitcoinLocksTable.ts';
import CopyToClipboard from '../components/CopyToClipboard.vue';
import BitcoinQrCode from '../components/BitcoinQrCode.vue';
import CopyIcon from '../assets/copy.svg?component';
import numeral from '../lib/numeral.ts';

const bitcoinLocks = useBitcoinLocks();

const emit = defineEmits<{
  close: [];
}>();

const props = defineProps<{
  lock: IBitcoinLockRecord;
}>();

const currency = useCurrency();

const amountUnit = ref<'BTC' | 'sats'>('BTC');

const formattedSatoshis = computed(() => {
  const sats = props.lock.lockDetails.satoshis;
  return amountUnit.value === 'sats'
    ? numeral(Number(sats)).format()
    : numeral(currency.satsToBtc(sats)).format('0,0.[00000000]');
});

let fundingBip21 = ref('');
let scriptPaytoAddress = ref('');
onMounted(async () => {
  await bitcoinLocks.load();
  try {
    scriptPaytoAddress.value = bitcoinLocks.formatP2swhAddress(props.lock.lockDetails.p2wshScriptHashHex);
  } catch (error) {
    console.error('Error formatting P2WSH address:', error);
    throw new Error('Failed to format P2WSH address');
  }
  const btcAmount = numeral(Number(props.lock.satoshis) / Number(SATS_PER_BTC)).format('0,0.[00000000]');
  const label = encodeURIComponent(`Argon Vault #${props.lock.vaultId} (utxo id=${props.lock.utxoId})`);
  const message = encodeURIComponent(
    `Personal BTC funding for Vault #${props.lock.vaultId}, Utxo Id #${props.lock.utxoId}`,
  );
  fundingBip21.value = `bitcoin:${scriptPaytoAddress.value}?amount=${btcAmount}&label=${label}&message=${message}`;
});
</script>
