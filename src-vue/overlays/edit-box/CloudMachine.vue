<!-- prettier-ignore -->
<template>
  <p class="text-md mb-3">
    Don't worry about this setting for now. In the next step, we'll guide you through the process of setting up your cloud machine and launching your mining bot.
  </p>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { BidAmountAdjustmentType, BidAmountFormulaType } from '@argonprotocol/commander-calculator/src/IBiddingRules';
import { type IOption } from '../../components/InputMenu.vue';
import { getCalculator } from '../../stores/mainchain';
import { useConfig } from '../../stores/config';

const config = useConfig();
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
