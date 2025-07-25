<!-- prettier-ignore -->
<template>
  <p class="text-md mb-3">
    This is your bot's minimum bid. Don't put it too low or you'll pay unneeded rebidding fees, but if you're too high, you might overpay.
  </p>

  <label class="font-bold opacity-60 mb-0.5">
    Formula Type
  </label>
  <div v-if="options.length" class="flex flex-row items-center justify-between">
    <InputMenu v-model="config.biddingRules.minimumBidFormulaType" :options="options" />
  </div>

  <template v-if="config.biddingRules.minimumBidFormulaType === BidAmountFormulaType.Custom">
    <label class="mt-3 font-bold opacity-60 mb-0.5">
      Value
    </label>
    <InputArgon v-model="config.biddingRules.minimumBidCustom" :min="0n" class="min-w-60" />
  </template>
  <template v-else>
    <label class="mt-3 font-bold opacity-60 mb-0.5">
      Additional Adjustment
    </label>
    <div v-if="options.length" class="flex flex-row items-center justify-between space-x-3">
      <InputMenu v-model="config.biddingRules.minimumBidAdjustmentType" :options="[
        { name: BidAmountAdjustmentType.Absolute, value: BidAmountAdjustmentType.Absolute }, 
        { name: BidAmountAdjustmentType.Relative, value: BidAmountAdjustmentType.Relative }
      ]" class="w-1/3" />
      <InputArgon v-if="isAbsoluteType" v-model="config.biddingRules.minimumBidAdjustAbsolute" class="w-1/3" />
      <InputNumber v-else v-model="config.biddingRules.minimumBidAdjustRelative" :min="-100" :dragBy="0.01" format="percent" class="w-1/3" />
      <div> = </div>
      <div class="border border-slate-400 rounded-md px-2 py-1 border-dashed w-1/3">
        {{ currency.symbol }}{{ microgonToArgonNm(calculator.minimumBidAmount).format('0,0.00') }}
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { BidAmountAdjustmentType, BidAmountFormulaType } from '@argonprotocol/commander-calculator/src/IBiddingRules';
import InputMenu, { type IOption } from '../../components/InputMenu.vue';
import InputNumber from '../../components/InputNumber.vue';
import InputArgon from '../../components/InputArgon.vue';
import { getCalculator } from '../../stores/mainchain';
import { useConfig } from '../../stores/config';
import { useCurrency } from '../../stores/currency';
import { createNumeralHelpers } from '../../lib/numeral';

const config = useConfig();
const calculator = getCalculator();
const currency = useCurrency();

const { microgonToArgonNm } = createNumeralHelpers(currency);

const bidAmount = Vue.ref<bigint>(0n);

const options = Vue.ref<IOption[]>([]);

const isAbsoluteType = Vue.computed(
  () => config.biddingRules.minimumBidAdjustmentType === BidAmountAdjustmentType.Absolute,
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
