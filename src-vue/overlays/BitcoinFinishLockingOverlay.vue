  <!-- prettier-ignore -->
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
              <DialogTitle class="grow text-2xl font-bold">Finish Locking Your Bitcoin</DialogTitle>
              <div
                @click="closeOverlay"
                class="z-10 mr-1 flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-md border border-slate-400/60 text-sm/6 font-semibold hover:border-slate-500/60 hover:bg-[#f1f3f7] focus:outline-none">
                <XMarkIcon class="h-5 w-5 stroke-4 text-[#B74CBA]" />
              </div>
            </h2>

            <div class="px-3">
              <p class="mt-5 mb-4 text-gray-600 select-text">
                You must send exactly
                <strong>
                  {{ numeral(currency.satsToBtc(props.lock.lockDetails.satoshis)).format('0,0.[00000000]') }} BTC
                </strong>
                (or
                {{ numeral(props.lock.lockDetails.satoshis).format('0,0') }}
                sats) to the cosign address listed below. Make sure you send the exact amount. Failure to do so could
                result in a rejected transaction and possibly the loss of your bitcoin.
              </p>

              <div class="mb-4 rounded-lg border border-gray-300 p-4 font-mono">
                <CopyToClipboard :content="scriptPaytoAddress" class="relative cursor-pointer">
                  <span class="opacity-80">
                    {{ scriptPaytoAddress }}
                    <CopyIcon class="absolute top-1/2 right-0 h-4 w-4 -translate-y-1/2" />
                  </span>
                  <template #copied>
                    <div class="pointer-events-none absolute top-0 left-0 h-full w-full">
                      {{ scriptPaytoAddress }}
                      <CopyIcon class="absolute top-1/2 right-0 h-4 w-4 -translate-y-1/2" />
                    </div>
                  </template>
                </CopyToClipboard>
              </div>

              <div class="mb-4 flex flex-col items-center text-gray-500">
                <p>
                  Alternatively, many Bitcoin wallets allow you scan the following QR code to pre-fill the transfer
                  details.
                </p>
                <BitcoinQrCode class="mt-5 h-44 w-44 text-center" :bip21="fundingBip21" v-if="fundingBip21" />
                <CopyToClipboard :content="fundingBip21" class="relative mb-4 cursor-pointer">
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

              <button
                @click="$emit('close')"
                class="mb-2 w-full cursor-pointer rounded-lg bg-gray-200 px-6 py-2 hover:bg-gray-300">
                Close
              </button>
            </div>
          </Motion>
        </DialogContent>
      </AnimatePresence>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { abbreviateAddress } from '../lib/Utils';
import { useCurrency } from '../stores/currency.ts';
import { SATS_PER_BTC } from '@argonprotocol/mainchain';
import { useBitcoinLocks } from '../stores/bitcoin.ts';
import { IBitcoinLockRecord } from '../lib/db/BitcoinLocksTable.ts';
import CopyToClipboard from '../components/CopyToClipboard.vue';
import BitcoinQrCode from '../components/BitcoinQrCode.vue';
import CopyIcon from '../assets/copy.svg?component';
import numeral from '../lib/numeral.ts';
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import Draggable from './helpers/Draggable';
import BgOverlay from '../components/BgOverlay.vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { AnimatePresence, Motion } from 'motion-v';

const emit = defineEmits<{
  close: [];
}>();

const props = defineProps<{
  lock: IBitcoinLockRecord;
}>();

const bitcoinLocks = useBitcoinLocks();
const currency = useCurrency();

const draggable = Vue.reactive(new Draggable());

const fundingBip21 = Vue.ref('');
const scriptPaytoAddress = Vue.ref('');

function closeOverlay() {
  emit('close');
}

Vue.onMounted(async () => {
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
    `Personal BTC Funding for Vault #${props.lock.vaultId}, Utxo Id #${props.lock.utxoId}`,
  );
  fundingBip21.value = `bitcoin:${scriptPaytoAddress.value}?amount=${btcAmount}&label=${label}&message=${message}`;
});
</script>
