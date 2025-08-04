<!-- prettier-ignore -->
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
    <button
      class="opacity-60 bg-argon-500 hover:bg-argon-600 border border-argon-700 inner-button-shadow text-2xl font-bold text-white px-12 py-2 rounded-lg mx-auto block mt-10 cursor-pointer"
    >
      Liquid Lock Your Bitcoin
    </button>

    <div class="flex-grow flex flex-row items-end w-full">
      <div class="flex flex-col w-full px-5 pb-5">
        <ul
          class="flex flex-row text-center text-sm text-[#4B2B4E] w-full py-7 border-t border-b border-slate-300 mb-5"
        >
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="isLoaded">
                {{ numeral(bitcoinLocked).format('0,0.[00000000]') }}
              </template>
              <template v-else>---</template>
            </div>
            <div>Locked Bitcoins</div>
          </li>
          <li style="width: 1px" class="bg-slate-300"></li>
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="isLoaded">
                <span :class="[currency.symbol === '₳' ? 'font-semibold' : 'font-bold']">
                  {{ currency.symbol }}
                </span>
                {{ microgonToMoneyNm(liquidityRealized).formatIfElse('< 1_000', '0,0.00', '0,0') }}
              </template>
              <template v-else>---</template>
            </div>
            <div>Realized Liquidity</div>
          </li>
          <li style="width: 1px" class="bg-slate-300"></li>
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="isLoaded">{{ numeral(hodlerAPR).formatCapped('0,0', 9_999) }}%</template>
              <template v-else>---</template>
            </div>
            <div>Bitcoin Hodling Return</div>
          </li>
          <li style="width: 1px" class="bg-slate-300"></li>
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="isLoaded">{{ numeral(liquidLockingAPR).formatCapped('0,0', 9_999) }}%</template>
              <template v-else>---</template>
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
import { useCurrency } from '../stores/currency';
import { getBitcoinFees, getBitcoinPrices } from '../stores/bitcoin';
import Chart from '../components/Chart.vue';
import NibSlider from '../components/NibSlider.vue';
import Vault from '../lib/LlbVault';
import VaultSnapshot from '../lib/LlbVaultSnapshot';
import BitcoinFees from '../lib/BitcoinFees';
import { getMainchain } from '../stores/mainchain';
import numeral, { createNumeralHelpers } from '../lib/numeral';
import { useVaults } from '../stores/vaults.ts';

const mainchain = getMainchain();
const currency = useCurrency();

const { microgonToMoneyNm } = createNumeralHelpers(currency);
const bitcoinPrices = getBitcoinPrices();
const bitcoinFees = getBitcoinFees();

const chartRef = Vue.ref<InstanceType<typeof Chart> | null>(null);

const isLoaded = Vue.ref(false);

const bitcoinLocked = Vue.ref(0);
const liquidityRealized = Vue.ref(0n);
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
}

const vaults = useVaults();
Vue.onMounted(async () => {
  await vaults.load(true);
  vaults.getTotalLiquidityRealized().then(x => (liquidityRealized.value = x));
  bitcoinLocked.value = currency.satsToBtc(vaults.getTotalSatoshisLocked());
  loadChartData();
  isLoaded.value = true;
});
</script>
