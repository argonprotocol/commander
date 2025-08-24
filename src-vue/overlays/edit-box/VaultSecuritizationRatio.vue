<!-- prettier-ignore -->
<template>
  <p class="text-md mb-3">
    Bitcoins locked in your vault are protected from theft with Argon collateral. The more collateral you commit, the safer people will feel to lock bitcoin in your vault.
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
      Collateral Provided
    </div>
    <div class="flex flex-row items-center gap-2 w-full">
      <InputNumber v-model="collateralProvided" @update:model-value="updateCollateral" :min="100" :max="300" :dragBy="1" :maxDecimals="0" format="percent" class="w-1/2" />
      <div>=</div>
      <div class="border border-slate-400 rounded-md px-2 py-1 h-[32px] border-dashed w-1/2 font-mono text-sm text-gray-800">
        {{ config.vaultingRules.securitizationRatio }} to 1
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import BigNumber from 'bignumber.js';
import { ExclamationTriangleIcon } from '@heroicons/vue/20/solid';
import InputNumber from '../../components/InputNumber.vue';
import { getCalculator } from '../../stores/mainchain';
import { useConfig } from '../../stores/config';

const config = useConfig();
const calculator = getCalculator();
const showBidAmountAlert = Vue.ref(false);

const collateralProvided = Vue.ref(config.vaultingRules.securitizationRatio * 100);

function updateCollateral(value: number) {
  config.vaultingRules.securitizationRatio = BigNumber(value).dividedBy(100).toNumber();
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
