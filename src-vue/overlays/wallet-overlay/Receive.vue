<!-- prettier-ignore -->
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
          <p v-if="props.walletId === 'mng'" class="mt-2 font-light">
            Based on the rules you configured, your Mining Bot needs the following tokens in order to win seats:
          </p>
          <p v-else class="mt-2 font-light">
            Based on the rules configured in your account, your Vault needs the following tokens in order to operate:
          </p>

          <table>
            <thead>
              <tr>
                <td>Needed Tokens</td>
                <td>You Have</td>
                <td class="text-right">Status</td>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{{ microgonToArgonNm(requiredMicrogons).format('0,0.[00000000]') }} ARGN</td>
                <td>{{ microgonToArgonNm(wallet.availableMicrogons).format('0,0.[00000000]') }} ARGN</td>
                <td class="text-right">{{ wallet.availableMicrogons == requiredMicrogons ? 'success' : 'waiting' }}</td>
              </tr>
              <tr>
                <td>{{ micronotToArgonotNm(requiredMicronots).format('0,0.[00000000]') }} ARGNOT</td>
                <td>{{ micronotToArgonotNm(wallet.availableMicronots).format('0,0.[00000000]') }} ARGNOT</td>
                <td v-if="!requiredMicronots" class="text-right">--</td>
                <td v-else class="text-right">{{ wallet.availableMicronots == requiredMicronots ? 'success' : 'waiting' }}</td>
              </tr>
            </tbody>
          </table>

        </div>
        <div v-else>You haven't set any bidding rules. Please do so before adding funds.</div>
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

const requiredMicrogons = Vue.computed(() => {
  if (props.walletId === 'mng') {
    return config.biddingRules?.requiredMicrogons || 0n;
  } else if (props.walletId === 'vlt') {
    return config.vaultingRules?.requiredMicrogons || 0n;
  }
  return 0n;
});

const requiredMicronots = Vue.computed(() => {
  if (props.walletId === 'mng') {
    return config.biddingRules?.requiredMicronots || 0n;
  } else if (props.walletId === 'vlt') {
    return config.vaultingRules?.requiredMicronots || 0n;
  }
  return 0n;
});

const walletName = Vue.computed(() => {
  if (props.walletId === 'mng') {
    return 'Mining';
  } else if (props.walletId === 'vlt') {
    return 'Vaulting';
  }
});

const wallet = Vue.computed(() => {
  if (props.walletId === 'mng') {
    return wallets.mngWallet;
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
  @apply w-11/12 mt-6 font-mono text-md;
  thead {
    @apply font-bold uppercase;
  }
  td {
    @apply border-b border-slate-400/30 py-3;
  }
}

span[tag] {
  @apply text-xs uppercase px-2 rounded-full text-white font-bold ml-1;
}
</style>
