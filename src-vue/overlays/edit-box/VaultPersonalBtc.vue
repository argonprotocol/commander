<!-- prettier-ignore -->
<template>
  <p class="text-md mb-3">
    It's a good idea to kickstart your vault with some existing bitcoin.  It helps show people your vault is active, and
    the more bitcoin you lock, the faster you'll start earning returns.
  </p>

  <div v-if="showBidAmountAlert" class="rounded-md bg-yellow-50 p-4">
    <div class="flex">
      <div class="shrink-0">
        <ExclamationTriangleIcon class="size-5 text-yellow-400" aria-hidden="true" />
      </div>
      <div class="ml-3">
        <h3 class="text-sm font-medium text-yellow-800">Maximum Bid Overridden</h3>
        <div class="mt-1 text-sm text-yellow-700">
          <p>Your changes to growth rate has impacted the values used in your maximum bid. You might want to adjust your maximum bid after saving this screen.</p>
        </div>
      </div>
    </div>
  </div>

  <div class="flex flex-col w-full">
    <div class="mt-3 font-bold opacity-60 mb-0.5">
      Value of Bitcoin to Lock
    </div>
    <div class="flex flex-row items-center gap-2 w-full">
      <InputArgon v-model="config.vaultingRules.personalBtcInMicrogons" @update:model-value="updateValue" :maxDecimals="0" class="w-5/12" />
      <div>=</div>
      <div class="border border-slate-400 rounded-md px-2 py-1 h-[32px] border-dashed w-7/12 font-mono text-sm text-gray-800">
        {{ microgonToBtcNm(config.vaultingRules.personalBtcInMicrogons).format('0,0.[000000000000000]') }} <span class="opacity-50">BTC</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { ExclamationTriangleIcon } from '@heroicons/vue/20/solid';
import InputArgon from '../../components/InputArgon.vue';
import { getCalculator } from '../../stores/mainchain';
import { useConfig } from '../../stores/config';
import { useCurrency } from '../../stores/currency';
import { createNumeralHelpers } from '../../lib/numeral';

const config = useConfig();
const currency = useCurrency();
const calculator = getCalculator();

const { microgonToBtcNm } = createNumeralHelpers(currency);

const showBidAmountAlert = Vue.ref(false);

function updateValue(value: number) {
  // config.vaultingRules.securitizationRatio = BigNumber(value).dividedBy(100).toNumber();
}

Vue.watch(
  config.biddingRules,
  () => {
    if (calculator.minimumBidAmountFromExpectedGrowth || calculator.maximumBidAmountFromExpectedGrowth) {
      showBidAmountAlert.value = true;
    } else {
      showBidAmountAlert.value = false;
    }
  },
  { deep: true, immediate: true },
);

Vue.onMounted(() => {
  calculator.setPivotPoint('ExpectedGrowth');
});

Vue.onBeforeUnmount(() => {
  calculator.setPivotPoint(null);
});
</script>
