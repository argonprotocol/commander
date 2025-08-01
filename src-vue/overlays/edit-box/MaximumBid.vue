<!-- prettier-ignore -->
<template>
  <p class="text-md mb-3">
    Your bot is prohibited from going above this amount. You will be knocked out of contention if bidding goes above this amount.
  </p>

  <div v-if="showHasOverrideAlert" class="rounded-md bg-red-50 p-3 pb-2 mb-3">
    <div class="flex">
      <div class="shrink-0">
        <AlertIcon class="size-5 text-yellow-700" aria-hidden="true" />
      </div>
      <div class="ml-3">
        <h3 class="text-sm font-medium text-yellow-800">This Formula Has Changed By -{{currency.symbol}}{{ microgonToMoneyNm(formulaChangeAmount).format('0,0.00') }}</h3>
        <div class="mt-1 text-sm text-yellow-700">
          <p>You made changes to the Ecosystem Growth rates, which increased the value of you formula for Maximum Bid 
            (Breakeven at Slow Growth). Applying this change will affect your APY.</p>
          <button @click="applyChanges" class="text-sm text-yellow-700 font-bold px-5 py-1 border border-red-500 cursor-pointer rounded-md bg-red-100 hover:bg-red-200 mt-3 mb-2 inner-button-shadow">Apply Changes</button>
        </div>
      </div>
    </div>
  </div>
  
  <div :class="showHasOverrideAlert ? 'opacity-50 pointer-events-none' : ''" class="flex flex-col grow">
    <label class="font-bold opacity-60 mb-0.5">
      Formula Type
    </label>
    <div v-if="options.length" class="flex flex-row items-center justify-between">
      <InputMenu v-model="config.biddingRules.maximumBidFormulaType" :options="options" :selectFirst="true" />
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
        ]" :selectFirst="true" class="w-1/2" />
        <InputArgon v-if="isAbsoluteType" v-model="config.biddingRules.maximumBidAdjustAbsolute" class="min-w-60 w-1/2" />
        <InputNumber v-else v-model="config.biddingRules.maximumBidAdjustRelative" :min="-100" :dragBy="0.01" format="percent" class="w-1/2" />
        <div> = </div>
        <div class="border border-slate-400 rounded-md px-2 py-1 h-[32px] border-dashed w-1/3 font-mono text-sm text-gray-800">
          {{ currency.symbol }}{{ microgonToMoneyNm(calculator.maximumBidAmount).format('0,0.00') }}
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import {
  BidAmountAdjustmentType,
  BidAmountFormulaType,
} from '@argonprotocol/commander-calculator/src/IBiddingRules.ts';
import AlertIcon from '../../assets/alert.svg?component';
import InputMenu, { type IOption } from '../../components/InputMenu.vue';
import InputNumber from '../../components/InputNumber.vue';
import InputArgon from '../../components/InputArgon.vue';
import { getCalculator } from '../../stores/mainchain';
import { useConfig } from '../../stores/config';
import { useCurrency } from '../../stores/currency';
import { createNumeralHelpers } from '../../lib/numeral';

const emit = defineEmits<{
  (e: 'update:data'): void;
}>();

const config = useConfig();
const calculator = getCalculator();
const currency = useCurrency();
const { microgonToMoneyNm } = createNumeralHelpers(currency);

const bidAmount = Vue.ref<bigint>(0n);
const options = Vue.ref<IOption[]>([]);

const isAbsoluteType = Vue.computed(
  () => config.biddingRules.maximumBidAdjustmentType === BidAmountAdjustmentType.Absolute,
);

const showHasOverrideAlert = Vue.ref(false);
const formulaChangeAmount = Vue.ref<bigint>(0n);

let maximumBidAmountFromMinimumBid = calculator.maximumBidAmountFromMinimumBid;
let maximumBidAmountFromExpectedGrowth = calculator.maximumBidAmountFromExpectedGrowth;

function applyChanges() {
  calculator.maximumBidAmountFromMinimumBid = null;
  calculator.maximumBidAmountFromExpectedGrowth = null;
  emit('update:data');
  calculateOverrideAlert();
}

function beforeSave() {}

function beforeCancel() {
  calculator.maximumBidAmountFromMinimumBid = maximumBidAmountFromMinimumBid;
  calculator.maximumBidAmountFromExpectedGrowth = maximumBidAmountFromExpectedGrowth;
  calculateOverrideAlert();
}

function calculateOverrideAlert() {
  formulaChangeAmount.value =
    calculator.maximumBidAmount - (calculator.maximumBidAmountOverride || calculator.maximumBidAmount);
  if (calculator.maximumBidAmountOverride) {
    showHasOverrideAlert.value = true;
  } else {
    showHasOverrideAlert.value = false;
  }
}

Vue.watch(
  config.biddingRules,
  () => {
    calculateOverrideAlert();
  },
  { deep: true, immediate: true },
);

Vue.onBeforeMount(async () => {
  await calculator.isInitializedPromise;
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

// Expose functions that can be called from parent component
defineExpose({ beforeSave, beforeCancel });
</script>
