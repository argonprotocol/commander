<!-- prettier-ignore -->
<template>
  <p class="text-md mb-3">
    Your bot is prohibited from going above this amount. You will be knocked out of contention if bids go above this amount.
  </p>

  <label class="font-bold opacity-60 mb-0.5">
    Formula Type
  </label>
  <div v-if="options.length" class="flex flex-row items-center justify-between">
    <InputMenu v-model="config.biddingRules.maximumBidFormulaType" :options="options" />
  </div>

  <template v-if="config.biddingRules.maximumBidFormulaType === BidAmountFormulaType.Custom">
    <label class="mt-3 font-bold opacity-60 mb-0.5">
      Value
    </label>
    <InputArgon v-model="config.biddingRules.maximumBidCustom" :min="0n" class="min-w-60" />
  </template>
  <template v-else>
    <label class="mt-3 font-bold opacity-60 mb-0.5">
      Additional Adjustment
    </label>
    <div v-if="options.length" class="flex flex-row items-center justify-between space-x-3">
      <InputMenu v-model="config.biddingRules.maximumBidAdjustmentType" :options="[
        { name: BidAmountAdjustmentType.Absolute, value: BidAmountAdjustmentType.Absolute }, 
        { name: BidAmountAdjustmentType.Relative, value: BidAmountAdjustmentType.Relative }
      ]" class="w-1/2" />
      <InputArgon v-if="isAbsoluteType" v-model="config.biddingRules.maximumBidAdjustAbsolute" class="min-w-60 w-1/2" />
      <InputNumber v-else v-model="config.biddingRules.maximumBidAdjustRelative" :min="-100" :dragBy="0.01" format="percent" class="w-1/2" />
    </div>
  </template>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import {
  BidAmountAdjustmentType,
  BidAmountFormulaType,
} from '@argonprotocol/commander-calculator/src/IBiddingRules.ts';
import InputMenu, { type IOption } from '../../components/InputMenu.vue';
import InputNumber from '../../components/InputNumber.vue';
import InputArgon from '../../components/InputArgon.vue';
import { getCalculator } from '../../stores/mainchain';
import { useConfig } from '../../stores/config';

const config = useConfig();
const calculator = getCalculator();

const bidAmount = Vue.ref<bigint>(0n);
const options = Vue.ref<IOption[]>([]);

const isAbsoluteType = Vue.computed(
  () => config.biddingRules.maximumBidAdjustmentType === BidAmountAdjustmentType.Absolute,
);

Vue.onBeforeMount(async () => {
  await calculator.isInitialized;
  bidAmount.value = calculator.data.previousDayLowBid;
  options.value = [
    {
      name: 'Previous Day High',
      value: BidAmountFormulaType.PreviousDayHigh,
      microgons: calculator.data.previousDayHighBid,
    },
    {
      name: 'Previous Day Average',
      value: BidAmountFormulaType.PreviousDayMid,
      microgons: calculator.data.previousDayMidBid,
    },
    {
      name: 'Previous Day Low',
      value: BidAmountFormulaType.PreviousDayLow,
      microgons: calculator.data.previousDayLowBid,
    },
    {
      name: 'Breakeven at Slow Growth',
      value: BidAmountFormulaType.BreakevenAtSlowGrowth,
      microgons: calculator.breakevenBidAtSlowGrowth,
    },
    {
      name: 'Breakeven at Medium Growth',
      value: BidAmountFormulaType.BreakevenAtSlowGrowth,
      microgons: calculator.breakevenBidAtSlowGrowth,
    },
    {
      name: 'Breakeven at Fast Growth',
      value: BidAmountFormulaType.BreakevenAtFastGrowth,
      microgons: calculator.breakevenBidAtFastGrowth,
    },
    { name: 'Custom Amount', value: BidAmountFormulaType.Custom },
  ];
});
</script>
