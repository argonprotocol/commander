<template>
  <div class="flex flex-col h-full opacity-60 pointer-events-none">
    <div style="text-shadow: 1px 1px 0 white">
      <div class="text-5xl leading-tight font-bold text-center mt-20 text-[#4B2B4E]">
        Unlock Your Bitcoin Liquidity By
        <div>Hedging Against Downside Volatility</div>
      </div>
      <p class="text-base text-justify w-[780px] !mx-auto mt-10 text-[#4B2B4E]">
        Argon's Liquid Locking allows you to convert the market value of your Bitcoin into Argon Stablecoins in a way
        that hedges against a drop in bitcoin price. Your newly received argons can be invested or spent however you
        want. The best thing is, your locked bitcoin creates an unencumbered argon short, which becomes immensely
        valuable if the argon ever falls below target price.  
      </p>
      </div>
    <button class="opacity-60 bg-argon-500 hover:bg-argon-600 border border-argon-700 inner-button-shadow text-2xl font-bold text-white px-12 py-2 rounded-lg mx-auto block mt-10 cursor-pointer">Liquid Lock Your Bitcoin</button>

    <div class="flex-grow flex flex-row items-end w-full">
      <div class="flex flex-col w-full px-5 pb-5">
        <ul class="flex flex-row text-center text-sm text-[#4B2B4E] w-full py-7 border-t border-b border-slate-300 mb-5">
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="isLoaded">
                {{ fmtCommas(fmtDecimalsMax(bitcoinLocked)) }}
              </template>
              <template v-else>
                ---
              </template>
            </div>
            <div>Locked Bitcoins</div>
          </li>
          <li style="width: 1px" class="bg-slate-300"></li>
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="isLoaded">
                <span :class="[currencySymbol === '₳' ? 'font-semibold' : 'font-bold']">{{currencySymbol}}</span>{{ fmtMoney(argonTo(liquidityRealized), 1_000) }}
              </template>
              <template v-else>
                ---
              </template>
            </div>
            <div>Realized Liquidity</div>
          </li>
          <li style="width: 1px" class="bg-slate-300"></li>
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="isLoaded">
                {{ fmtMoney(Math.min(hodlerAPR, 999_999), 100) }}%{{ hodlerAPR >= 9_999? '+' : ' ' }}
              </template>
              <template v-else>
                ---
              </template>
            </div>
            <div>Bitcoin Hodling Return</div>
          </li>
          <li style="width: 1px" class="bg-slate-300"></li>
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="isLoaded">
                {{ fmtCommas(fmtDecimalsMax(Math.min(liquidLockingAPR, 999_999))) }}%{{ liquidLockingAPR >= 9_999? '+' : ' ' }}
              </template>
              <template v-else>
                ---
              </template>
            </div>
            <div>Liquid Locking Return</div>
          </li>
        </ul>
        <div class="flex flex-row justify-center h-[137px]">
          <Chart ref="chartRef" />
          <NibSlider ref="nibSliderLeftRef" position="left" :pos="50" :isActive="false" />
          <NibSlider ref="nibSliderRightRef" position="right" :pos="490" :isActive="false" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { fmtMoney, fmtCommas, fmtDecimalsMax } from '../lib/Utils';
import { useBlockchainStore } from '../stores/blockchain';
import { useConfigStore } from '../stores/config';
import { storeToRefs } from 'pinia';
import { useBitcoinStore } from '../stores/bitcoin';
import Chart from '../components/Chart.vue';
import Vault from '../lib/Vault';
import VaultSnapshot from '../lib/VaultSnapshot';
import BitcoinFees from '../lib/BitcoinFees';
import NibSlider from '../components/NibSlider.vue';
import { getMainchain } from '../lib/mainchain';

const mainchain = getMainchain();
const blockchainStore = useBlockchainStore();
const configStore = useConfigStore();
const bitcoinStore = useBitcoinStore();

const { bitcoinPrices, bitcoinFees } = bitcoinStore;

const chartRef = Vue.ref<InstanceType<typeof Chart> | null>(null);

const { argonTo, btcToArgon } = configStore;
const { currencySymbol } = storeToRefs(configStore);

const isLoaded = Vue.ref(false);

const bitcoinLocked = Vue.ref(0);
const liquidityRealized = Vue.ref(0);
const hodlerAPR = Vue.ref(350);
const liquidLockingAPR = Vue.ref(72);

function loadChartData() {
  const items: any[] = [];

  for (const [index, priceRecord] of bitcoinPrices.all.entries()) {
    const item = {
      ...priceRecord,
      showPointOnChart: index === 0,
      fee: bitcoinFees.getByDate(priceRecord.date),
      previous: items[index - 1],
      next: undefined,
    };
    items.push(item);
  }

  for (const [index, item] of items.entries()) {
    item.next = items[index + 1];
  }

  chartRef.value?.reloadData(items);
  // updateLeftSlider(sliderIndexes.value.left);
  // updateRightSlider(sliderIndexes.value.right);

  const vault = new Vault('2025-01-01', '2025-05-09', 10, [], bitcoinPrices, bitcoinFees as BitcoinFees, 1);
  const snapshot = new VaultSnapshot();
  snapshot.update(vault);
  hodlerAPR.value = snapshot.hodlerProfit * 100;
  liquidLockingAPR.value = snapshot.vaulterProfit * 100;

  console.log(snapshot);
}

Vue.onMounted(async () => {
  const vaults = await mainchain.fetchVaults();
  bitcoinLocked.value = vaults.reduce((acc, vault) => acc + vault.bitcoinLocked, 0);
  liquidityRealized.value = btcToArgon(vaults.reduce((acc, vault) => acc + vault.bitcoinLocked, 0));
  loadChartData();
  isLoaded.value = true;
});
</script>