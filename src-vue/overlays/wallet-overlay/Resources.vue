<!-- prettier-ignore -->
<template>
  <ul>
    <li
      v-for="resource of resourceList"
      :key="resource.name"
      class="flex flex-row justify-between items-center w-full border-t border-black/10 first:border-black/30 pb-3 py-4 px-2"
    >
      <div class="flex flex-row justify-between items-center pr-6">
        <component :is="resource.icon" class="w-14 text-argon-600" />
      </div>
      <div class="flex flex-col justify-between items-start grow">
        <div class="text-xl font-bold">{{ resource.name }}</div>
        <div class="">{{ resource.itemCountStr }} {{ resource.itemCountLabel }}</div>
      </div>
      <div class="flex flex-col justify-between items-end">
        <div class="font-bold">
          {{ currency.symbol }}{{ microgonToMoneyNm(resource.microgonValue).format('0,0.00') }}
        </div>
        <div v-if="resource.uniswapUrl" class="text-argon-600/80 hover:text-argon-600 cursor-pointer" @click="openUniswapMarket(resource.uniswapUrl)">Open Uniswap Market</div>
        <div v-else class="text-slate-700/50">Not Transferable</div>
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { open } from '@tauri-apps/plugin-shell';
import { useCurrency } from '../../stores/currency';
import { useWallets } from '../../stores/wallets';
import ArgonToken from '../../assets/resources/argon.svg?component';
import ArgonotToken from '../../assets/resources/argonot.svg?component';
import ArgonotLockedToken from '../../assets/resources/argonot-locked.svg?component';
import MiningSeatToken from '../../assets/resources/mining-seat.svg?component';
import MiningBidToken from '../../assets/resources/mining-bid.svg?component';
import { useStats } from '../../stores/stats';
import numeral, { createNumeralHelpers } from '../../lib/numeral';
import basicEmitter from '../../emitters/basicEmitter';
import { useConfig } from '../../stores/config';

const props = defineProps<{
  walletId: 'mining' | 'vaulting';
}>();

const stats = useStats();
const currency = useCurrency();
const wallets = useWallets();
const config = useConfig();

const { microgonToArgonNm, micronotToArgonotNm, microgonToMoneyNm } = createNumeralHelpers(currency);
const miningWallet = Vue.computed(() => wallets.miningWallet);
const vaultingWallet = Vue.computed(() => wallets.vaultingWallet);

const emit = defineEmits(['navigate']);

interface IResource {
  name: string;
  icon: any;
  itemCountStr: string;
  itemCountLabel: string;
  microgonValue: bigint;
  diff: number;
  uniswapUrl?: string | null;
}

async function openUniswapMarket(uniswapUrl: string) {
  if (config.isValidJurisdiction) {
    await open(uniswapUrl);
  } else {
    emit('navigate', { close: true });
    basicEmitter.emit('openComplianceOverlay');
  }
}

const resources: Record<'mining' | 'vaulting', Vue.ComputedRef<IResource[]>> = {
  mining: Vue.computed<IResource[]>(() => {
    return [
      {
        name: 'Argons',
        icon: ArgonToken,
        itemCountStr: microgonToArgonNm(miningWallet.value.availableMicrogons).format('0,0.[00000000]'),
        itemCountLabel: 'ARGNs',
        microgonValue: miningWallet.value.availableMicrogons,
        diff: 0,
        uniswapUrl: 'https://app.uniswap.org/explore/tokens/ethereum/0x6a9143639d8b70d50b031ffad55d4cc65ea55155',
      },
      {
        name: 'Argonots',
        icon: ArgonotToken,
        itemCountStr: micronotToArgonotNm(miningWallet.value.availableMicronots).format('0,0.[00000000]'),
        itemCountLabel: 'ARGNOTs',
        microgonValue: currency.micronotToMicrogon(miningWallet.value.availableMicronots),
        diff: 0,
        uniswapUrl: 'https://app.uniswap.org/explore/tokens/ethereum/0x64cbd3aa07d427e385cb55330406508718e55f01',
      },
      {
        name: 'Locked Argonots',
        icon: ArgonotLockedToken,
        itemCountStr: micronotToArgonotNm(miningWallet.value.reservedMicronots).format('0,0.[00000000]'),
        itemCountLabel: 'ARGNOTs',
        microgonValue: currency.micronotToMicrogon(miningWallet.value.reservedMicronots),
        diff: 0,
      },
      {
        name: 'Mining Bids',
        icon: MiningBidToken,
        itemCountStr: numeral(stats.myMiningBids.bidCount).format('0,0'),
        itemCountLabel: `Bids @ ${numeral(stats.myMiningBids.microgonsBid / BigInt(stats.myMiningBids.bidCount || 1)).format('0,0.00')} Per Bid`,
        microgonValue: wallets.miningBidValue,
        diff: 0,
      },
      {
        name: 'Mining Seats',
        icon: MiningSeatToken,
        itemCountStr: numeral(stats.myMiningSeats.seatCount).format('0'),
        itemCountLabel: 'Seats',
        microgonValue: wallets.miningSeatValue,
        diff: 0,
      },
    ];
  }),
  vaulting: Vue.computed<IResource[]>(() => {
    return [
      {
        name: 'Argons',
        icon: ArgonToken,
        itemCountStr: microgonToArgonNm(vaultingWallet.value.availableMicrogons).format('0,0.[00000000]'),
        itemCountLabel: 'ARGNs',
        microgonValue: vaultingWallet.value.availableMicrogons,
        diff: 0,
        uniswapUrl: 'https://app.uniswap.org/explore/tokens/ethereum/0x6a9143639d8b70d50b031ffad55d4cc65ea55155',
      },
      {
        name: 'Argonots',
        icon: ArgonotToken,
        itemCountStr: micronotToArgonotNm(vaultingWallet.value.availableMicronots).format('0,0.[00000000]'),
        itemCountLabel: 'ARGNOTs',
        microgonValue: currency.micronotToMicrogon(vaultingWallet.value.availableMicronots),
        diff: 0,
        uniswapUrl: 'https://app.uniswap.org/explore/tokens/ethereum/0x6a9143639d8b70d50b031ffad55d4cc65ea55155',
      },
      {
        name: 'Vaulted Argonots',
        icon: ArgonotLockedToken,
        itemCountStr: micronotToArgonotNm(vaultingWallet.value.reservedMicronots).format('0,0.[00000000]'),
        itemCountLabel: 'ARGNOTs',
        microgonValue: currency.micronotToMicrogon(vaultingWallet.value.reservedMicronots),
        diff: 0,
        uniswapUrl: 'https://app.uniswap.org/explore/tokens/ethereum/0x6a9143639d8b70d50b031ffad55d4cc65ea55155',
      },
    ];
  }),
};

const resourceList = Vue.computed(() => resources[props.walletId].value);

function navigate(screen: string) {
  emit('navigate', { screen });
}
</script>
