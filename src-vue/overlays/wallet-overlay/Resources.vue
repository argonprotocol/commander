<!-- prettier-ignore -->
<template>
  <ul>
    <li
      v-for="resource of resourceList"
      :key="resource.name"
      class="flex flex-row justify-between items-center w-full border-t border-black/10 first:border-black/30 pb-5 cursor-pointer hover:bg-slate-200/30 py-4 px-2"
    >
      <div class="flex flex-row justify-between items-center pr-6">
        <component :is="resource.icon" class="w-16 text-argon-600" />
      </div>
      <div class="flex flex-col justify-between items-start grow">
        <div class="text-xl font-bold">{{ resource.name }}</div>
        <div class="">{{ resource.itemCountStr }} {{ resource.itemCountLabel }}</div>
      </div>
      <div class="flex flex-col justify-between items-end">
        <div class="font-bold">
          {{ currency.symbol }}{{ microgonToMoneyNm(resource.microgonValue).format('0,0.00') }}
        </div>
        <div class="">0.00%</div>
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useCurrency } from '../../stores/currency';
import { useWallets } from '../../stores/wallets';
import ArgonToken from '../../assets/resources/argon.svg?component';
import ArgonotToken from '../../assets/resources/argonot.svg?component';
import ArgonotLockedToken from '../../assets/resources/argonot-locked.svg?component';
import MiningSeatToken from '../../assets/resources/mining-seat.svg?component';
import MiningBidToken from '../../assets/resources/mining-bid.svg?component';
import { useStats } from '../../stores/stats';
import numeral, { createNumeralHelpers } from '../../lib/numeral';

const props = defineProps<{
  walletId: 'mng' | 'vlt';
}>();

const stats = useStats();
const currency = useCurrency();
const wallets = useWallets();

const { microgonToArgonNm, micronotToArgonotNm, microgonToMoneyNm } = createNumeralHelpers(currency);
const mngWallet = Vue.computed(() => wallets.mngWallet);

const emit = defineEmits(['navigate']);

const miningSeatValue = Vue.computed(() => {
  return (
    stats.miningSeats.microgonsToBeMined +
    currency.micronotToMicrogon(stats.miningSeats.micronotsToBeMined) +
    currency.micronotToMicrogon(stats.miningSeats.micronotsMined) +
    stats.miningSeats.microgonsMinted +
    stats.miningSeats.microgonsMined
  );
});

interface IResource {
  name: string;
  icon: any;
  itemCountStr: string;
  itemCountLabel: string;
  microgonValue: bigint;
  diff: number;
  uniswapUrl?: string | null;
}

const resources: Record<'mng' | 'vlt', Vue.ComputedRef<IResource[]>> = {
  mng: Vue.computed<IResource[]>(() => {
    return [
      {
        name: 'Argons',
        icon: ArgonToken,
        itemCountStr: microgonToArgonNm(mngWallet.value.availableMicrogons).format('0,0.[00000000]'),
        itemCountLabel: 'ARGN',
        microgonValue: mngWallet.value.availableMicrogons,
        diff: 0,
        uniswapUrl: 'https://app.uniswap.org/explore/tokens/ethereum/0x6a9143639d8b70d50b031ffad55d4cc65ea55155',
      },
      {
        name: 'Argonots',
        icon: ArgonotToken,
        itemCountStr: micronotToArgonotNm(mngWallet.value.availableMicronots).format('0,0.[00000000]'),
        itemCountLabel: 'ARGNOT',
        microgonValue: currency.micronotToMicrogon(mngWallet.value.availableMicronots),
        diff: 0,
        uniswapUrl: 'https://app.uniswap.org/explore/tokens/ethereum/0x6a9143639d8b70d50b031ffad55d4cc65ea55155',
      },
      {
        name: 'Locked Argonots',
        icon: ArgonotLockedToken,
        itemCountStr: micronotToArgonotNm(mngWallet.value.reservedMicronots).format('0,0.[00000000]'),
        itemCountLabel: 'ARGNOT',
        microgonValue: currency.micronotToMicrogon(mngWallet.value.reservedMicronots),
        diff: 0,
        uniswapUrl: 'https://app.uniswap.org/explore/tokens/ethereum/0x6a9143639d8b70d50b031ffad55d4cc65ea55155',
      },
      {
        name: 'Active Mining Seats',
        icon: MiningSeatToken,
        itemCountStr: numeral(stats.miningSeats.activeSeats).format('0'),
        itemCountLabel: 'Seats',
        microgonValue: miningSeatValue.value,
        diff: 0,
      },
      {
        name: 'Current Mining Bids',
        icon: MiningBidToken,
        itemCountStr: numeral(stats.myMiningBidCount).format('0,0'),
        itemCountLabel: `Bids @ ${numeral(stats.myMiningBidCost / BigInt(stats.myMiningBidCount || 1)).format('0,0.00')} Per Bid`,
        microgonValue: stats.myMiningBidCost,
        diff: 0,
      },
    ];
  }),
  vlt: Vue.computed<IResource[]>(() => {
    return [
      {
        name: 'Argons',
        icon: ArgonToken,
        itemCountStr: microgonToArgonNm(mngWallet.value.availableMicrogons).format('0,0.[00000000]'),
        itemCountLabel: 'ARGN',
        microgonValue: mngWallet.value.availableMicrogons,
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
