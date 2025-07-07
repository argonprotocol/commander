<template>
  <div>
    <div class="flex flex-row justify-between items-center w-full pt-2 pb-3 space-x-1 border-b border-black/20">
      <div class="flex flex-row items-center hover:bg-[#f1f3f7] rounded-md p-1 cursor-pointer ml-3">
        <ChevronLeftIcon @click="goBack" class="w-6 h-6 cursor-pointer relative -top-0.25" />
      </div>
      <div class="text-2xl font-bold grow">Add Funds to Your {{ walletName }} Wallet</div>
      <div
        @click="closeOverlay"
        class="mr-2 z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/60 hover:bg-[#f1f3f7]"
      >
        <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
      </div>
    </div>

    <div class="flex flex-row items-start w-full pt-3 pb-10 px-5 gap-x-5">
      <div class="flex flex-col grow pt-2 text-md">
        <div v-if="config.biddingRules">
          <p class="font-light">
            You can use any polkadot/substrate compatible wallet to add funds to your Commander account. Just scan the
            QR code shown on the right, or copy and paste the address that’s printed below it.
          </p>
          <p class="mt-2 font-light">
            Based on the rules you configured, your Bidding Bot needs the following tokens in order to optimize its
            ability to win seats:
          </p>

          <table>
            <thead>
              <tr>
                <td>Optimal Tokens</td>
                <td>You Have</td>
                <td>Still Needed</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{{ config.biddingRules?.desiredMicrogons }} ARGN</td>
                <td>{{ wallet.availableMicrogons }} ARGN</td>
                <td>
                  {{ microgonToArgonNm(desiredMicrogonsStillNeeded).format('0,0.[00000000]') }} ARGN
                  <span
                    tag
                    :class="
                      desiredMicrogonsStillNeeded > 0
                        ? 'bg-green-600/90 border border-green-700'
                        : 'bg-gray-400/90 border border-gray-500'
                    "
                  >
                    FOR OPTIMAL
                  </span>
                </td>
              </tr>
              <tr>
                <td>{{ config.biddingRules?.desiredMicronots }} ARGNOT</td>
                <td>{{ wallet.availableMicronots }} ARGNOT</td>
                <td>
                  {{ micronotToArgonotNm(desiredMicronotsStillNeeded).format('0,0.[00000000]') }} ARGNOT
                  <span
                    tag
                    :class="
                      desiredMicronotsStillNeeded > 0
                        ? 'bg-green-500/90 border border-green-700'
                        : 'bg-gray-400/90 border border-gray-500'
                    "
                  >
                    FOR OPTIMAL
                  </span>
                </td>
              </tr>
            </tbody>
          </table>

          <p class="mt-6">
            The above table shows the optimal amounts desired. However, your Bot cannot operate if it has anything less
            than the following:
          </p>

          <table>
            <thead>
              <tr>
                <td>Minimum Tokens</td>
                <td>You Have</td>
                <td>Still Needed</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{{ config.biddingRules?.requiredMicrogons }} ARGN</td>
                <td>{{ wallet.availableMicrogons }} ARGN</td>
                <td>
                  {{ microgonToArgonNm(requiredMicrogonsStillNeeded).format('0,0.[00000000]') }} ARGN
                  <span
                    tag
                    :class="
                      requiredMicrogonsStillNeeded > 0
                        ? 'bg-red-500 border border-red-700'
                        : 'bg-gray-400/90 border border-gray-500'
                    "
                  >
                    FOR MINIMUM
                  </span>
                </td>
              </tr>
              <tr>
                <td>{{ config.biddingRules?.requiredMicronots }} ARGNOT</td>
                <td>{{ wallet.availableMicronots }} ARGNOT</td>
                <td>
                  {{ micronotToArgonotNm(requiredMicronotsStillNeeded).format('0,0.[00000000]') }} ARGNOT
                  <span
                    tag
                    :class="
                      requiredMicronotsStillNeeded > 0
                        ? 'bg-red-500 border border-red-700'
                        : 'bg-gray-400/90 border border-gray-500'
                    "
                  >
                    FOR MINIMUM
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else>You haven't set any bidding rules. Please do so.</div>
      </div>
      <div class="flex flex-col w-full max-w-44 items-end justify-end">
        <img :src="qrCode" width="100%" />
        <CopyToClipboard :content="wallet.address" class="relative mb-3 mr-5 cursor-pointer">
          <span class="opacity-80">
            {{ abreviateAddress(wallet.address) }}
            <CopyIcon class="w-4 h-4 ml-1 inline-block" />
          </span>
          <template #copied>
            <div class="absolute top-0 left-0 w-full h-full pointer-events-none">
              {{ abreviateAddress(wallet.address) }}
              <CopyIcon class="w-4 h-4 ml-1 inline-block" />
            </div>
          </template>
        </CopyToClipboard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import QRCode from 'qrcode';
import { useConfig } from '../../stores/config';
import { useWallets } from '../../stores/wallets';
import { useCurrency } from '../../stores/currency';
import { abreviateAddress } from '../../lib/Utils';
import { ChevronLeftIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import CopyIcon from '../../assets/copy.svg?component';
import CopyToClipboard from '../../components/CopyToClipboard.vue';
import numeral, { createNumeralHelpers } from '../../lib/numeral';

const props = defineProps({
  walletId: {
    type: String as Vue.PropType<'mng' | 'llb' | 'vlt'>,
    required: true,
  },
});

const config = useConfig();
const wallets = useWallets();
const currency = useCurrency();

const { microgonToArgonNm, micronotToArgonotNm } = createNumeralHelpers(currency);

const emit = defineEmits(['navigate']);

function goBack() {
  emit('navigate', { screen: 'main' });
}

const qrCode = Vue.ref('');

function stillNeeded(amount: bigint, walletValue: bigint) {
  const stillNeeded = amount - walletValue === 0n ? 0n : amount - walletValue;
  return stillNeeded > 0n ? stillNeeded : 0n;
}

const desiredMicrogonsStillNeeded = Vue.computed(() => {
  return stillNeeded(config.biddingRules?.desiredMicrogons || 0n, wallet.value.availableMicrogons || 0n);
});

const desiredMicronotsStillNeeded = Vue.computed(() => {
  return stillNeeded(config.biddingRules?.desiredMicronots || 0n, wallet.value.availableMicronots || 0n);
});

const requiredMicrogonsStillNeeded = Vue.computed(() => {
  return stillNeeded(config.biddingRules?.requiredMicrogons || 0n, wallet.value.availableMicrogons || 0n);
});

const requiredMicronotsStillNeeded = Vue.computed(() => {
  return stillNeeded(config.biddingRules?.requiredMicronots || 0n, wallet.value.availableMicronots || 0n);
});

const walletName = Vue.computed(() => {
  if (props.walletId === 'mng') {
    return 'Mining';
  } else if (props.walletId === 'llb') {
    return 'Liquid Locking';
  } else if (props.walletId === 'vlt') {
    return 'Vaulting';
  }
});

const wallet = Vue.computed(() => {
  if (props.walletId === 'mng') {
    return wallets.mngWallet;
  } else if (props.walletId === 'llb') {
    return wallets.llbWallet;
  } else if (props.walletId === 'vlt') {
    return wallets.vltWallet;
  } else {
    return {
      address: '',
      availableMicrogons: 0n,
      availableMicronots: 0n,
    };
  }
});

async function loadQRCode() {
  let address = '';
  if (props.walletId === 'mng') {
    address = wallets.mngWallet.address;
  } else if (props.walletId === 'llb') {
    address = wallets.llbWallet.address;
  } else if (props.walletId === 'vlt') {
    address = wallets.vltWallet.address;
  }
  qrCode.value = await QRCode.toDataURL(address);
}

function closeOverlay() {
  emit('navigate', { close: true });
}

Vue.onMounted(() => {
  loadQRCode();
});
</script>

<style scoped>
@reference "../../main.css";

table {
  @apply w-full text-md mt-6 font-mono text-md;
  thead {
    @apply font-bold uppercase;
  }
  td {
    @apply border-b border-slate-400/30 py-1;
  }
}

span[tag] {
  @apply text-xs uppercase px-2 rounded-full text-white font-bold ml-1;
}
</style>
