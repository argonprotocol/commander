<!-- prettier-ignore -->
<template>
  <p class="text-md mb-3">
    This is your bot's starting bid. Don't put it too low or you'll pay unneeded rebidding fees, but if you're too high, you might overpay.
  </p>

  <label class="font-bold opacity-60 mb-0.5">
    Formula Type
  </label>
  <div v-if="options.length" class="flex flex-row items-center justify-between">
    <InputMenu v-model="config.biddingRules.startingBidAmountFormulaType" :options="options" />
  </div>

  <template v-if="config.biddingRules.startingBidAmountFormulaType === BidAmountFormulaType.Custom">
    <label class="mt-3 font-bold opacity-60 mb-0.5">
      Value
    </label>
    <InputNumber 
        v-model="config.biddingRules.startingBidAmountCustom"
        :min="0"
        format="argons"
        class="min-w-60"
      />
  </template>
  <template v-else>
    <label class="mt-3 font-bold opacity-60 mb-0.5">
      Additional Adjustment
    </label>
    <div v-if="options.length" class="flex flex-row items-center justify-between space-x-3">
      <InputMenu v-model="config.biddingRules.startingBidAmountAdjustmentType" :options="[
        { name: BidAmountAdjustmentType.Absolute, value: BidAmountAdjustmentType.Absolute }, 
        { name: BidAmountAdjustmentType.Relative, value: BidAmountAdjustmentType.Relative }
      ]" />
      <InputNumber v-if="isAbsoluteType" v-model="config.biddingRules.startingBidAmountRelative" :min="-100" :dragBy="0.01" format="percent" />
      <InputNumber v-else
        v-model="config.biddingRules.startingBidAmountAbsolute"
        :min="0"
        format="argons"
        class="min-w-60"
      />
      <div class="font-bold font-mono grow border border-slate-700/40 rounded-md text-gray-800 px-3 py-1">
        <div v-if="isAbsoluteType">+ {{ currency.symbol }}{{ microgonToMoneyNm(config.biddingRules.startingBidAmountAbsolute).format('0,0.00') }}</div>
        <div v-else>+ {{ numeral(config.biddingRules.startingBidAmountRelative).format('0,0.00') }}%</div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { BidAmountAdjustmentType, BidAmountFormulaType } from '@argonprotocol/commander-calculator/src/IBiddingRules';
import InputMenu, { type IOption } from '../../components/InputMenu.vue';
import InputNumber from '../../components/InputNumber.vue';
import { getCalculator } from '../../stores/mainchain';
import { useConfig } from '../../stores/config';
import { useCurrency } from '../../stores/currency';
import numeral, { createNumeralHelpers } from '../../lib/numeral';

const config = useConfig();
const currency = useCurrency();
const { microgonToMoneyNm } = createNumeralHelpers(currency);

const calculator = getCalculator();

const bidAmount = Vue.ref<bigint>(0n);

const options = Vue.ref<IOption[]>([]);

const isAbsoluteType = Vue.computed(
  () => config.biddingRules.startingBidAmountAdjustmentType === BidAmountAdjustmentType.Absolute,
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
      name: 'Minimum Breakeven',
      value: BidAmountFormulaType.MinimumBreakeven,
      microgons: calculator.minimumBreakevenBid,
    },
    {
      name: 'Optimistic Breakeven',
      value: BidAmountFormulaType.OptimisticBreakeven,
      microgons: calculator.optimisticBreakevenBid,
    },
    { name: 'Custom Amount', value: BidAmountFormulaType.Custom },
  ];
});
</script>
