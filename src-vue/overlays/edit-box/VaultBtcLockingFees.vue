<!-- prettier-ignore -->
<template>
  <!-- const tooltip = {
    capitalToCommit:
      'The more capital you commit, the more liquidity you provides to the network and therefore the higher your potential returns.',
    estimatedAPYRange:
      'These estimates are based on a combination of current pool rewards and the vault parameters you have configured below.',
    poolFunding:
      "This is how much of the Treasury Pool you want to fund with your own capital. If you set to less than 100%, you're relying on the community to fund the rest.",
    securitizationRatio:
      'This is the ratio of argons to bitcoins that you are committing. These argons guarantee the bitcoin holders that their assets are safe.',
    poolRevenueShare:
      'Outside funders can contribute to your Treasury Pool, and in return you agree to share a portion of your profits with them.',
    poolRevenueShareNa:
      'Since you are personally funding 100% of the Treasury Pool, there is no external capital to share profits with.',
    btcLockingFees: 'Each bitcoin transaction that locks in your vault must pay this flat fee for doing so.',
    btcLockingNoSpace:
      'You have committed 100% of the bitcoin needed to fill your vault, so no locking fees are possible.',
    projectedUtilization: `Your vault's utilization will determine how much revenue you earn and how much of the Treasury Pool can be activated. You can use this box to project various scenarios.`,
    personalBtc: `You'll probably want to bootstrap your vault with some of your own bitcoin. The more bitcoin, the sooner you'll start earning returns.`,
    saveRules: 'You can update these settings later.',
  }; -->
  <p class="text-md mb-3">
    This panel allows you to set the expected usage rates of your vault. Will the demand for Liquid Locking of Bitcoin be strong enough
    to keep your vault at capacity? Will people contribute to your treasury pool?
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

  <div class="mt-3 font-bold opacity-60 mb-0.5">
    Flat Fee
  </div>
  <div class="flex flex-row items-center gap-2 w-full">
    <InputArgon v-model="config.vaultingRules.btcFlatFee" class="w-full" />
  </div>

  <div class="mt-3 font-bold opacity-60 mb-0.5">
    Percentage Fee
  </div>
  <div class="flex flex-row items-center gap-2 w-full">
    <InputNumber v-model="config.vaultingRules.btcPctFee" :min="0" :dragBy="1" :dragByMin="0.1" :maxDecimals="1" format="percent" class="w-full" />
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { ExclamationTriangleIcon } from '@heroicons/vue/20/solid';
import InputNumber from '../../components/InputNumber.vue';
import InputArgon from '../../components/InputArgon.vue';
import { getBiddingCalculator } from '../../stores/mainchain';
import { useConfig } from '../../stores/config';

const config = useConfig();
const calculator = getBiddingCalculator();
const showBidAmountAlert = Vue.ref(false);

Vue.watch(
  config.biddingRules,
  () => {
    if (calculator.startingBidAmountFromExpectedGrowth || calculator.maximumBidAmountFromExpectedGrowth) {
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
