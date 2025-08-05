<template>
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold">Complete Bitcoin Lock</h2>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="text-center py-8">
        <div class="mb-6">
          <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h3 class="text-lg font-semibold mb-2">Send your BTC to the Cosign Address</h3>
          <p class="text-gray-600 mb-4 select-text">
            You must send {{ formattedSatoshis }}
            <select v-model="amountUnit" class="bg-gray-100 rounded border-l border-gray-300">
              <option value="BTC">BTC</option>
              <option value="sats">sats</option>
            </select>
            to:
          </p>

          <div class="bg-gray-100 p-4 rounded-lg mb-4">
            <CopyToClipboard :content="scriptPaytoAddress" class="relative mb-3 mr-5 cursor-pointer">
              <span class="opacity-80">
                {{ abreviateAddress(scriptPaytoAddress, 10) }}
                <CopyIcon class="w-4 h-4 ml-1 inline-block" />
              </span>
              <template #copied>
                <div class="absolute top-0 left-0 w-full h-full pointer-events-none">
                  {{ abreviateAddress(scriptPaytoAddress, 10) }}
                  <CopyIcon class="w-4 h-4 ml-1 inline-block" />
                </div>
              </template>
            </CopyToClipboard>
          </div>

          <div class="text-sm text-gray-500 mb-4 flex items-center flex-col">
            <p>You can scan the QR code below in many Bitcoin wallets to fund your lock.</p>
            <BitcoinQrCode class="w-44 h-44 mb-3 text-center" :bip21="fundingBip21" v-if="fundingBip21" />
            <CopyToClipboard :content="fundingBip21" class="relative mb-3 mr-5 cursor-pointer">
              <span class="opacity-80">
                {{ abreviateAddress(fundingBip21, 10) }}
                <CopyIcon class="w-4 h-4 ml-1 inline-block" />
              </span>
              <template #copied>
                <div class="absolute top-0 left-0 w-full h-full pointer-events-none">
                  {{ abreviateAddress(fundingBip21, 10) }}
                  <CopyIcon class="w-4 h-4 ml-1 inline-block" />
                </div>
              </template>
            </CopyToClipboard>
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
