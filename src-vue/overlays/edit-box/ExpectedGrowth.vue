<!-- prettier-ignore -->
<template>
  <p class="text-md mb-3">
    This panel allows you to set an expected growth rate if the Argon stablecoin circulation and the price of its Argonot (ownership token). The circulation growth
    is the percentage above and beyond the base circulation growth due to block rewards. All numbers are annual.
  </p>

  <label class="mt-3 font-bold opacity-60 mb-0.5">
    Growth In Argon Circulation
  </label>
  <div class="flex flex-row items-center gap-2 w-full">
    <InputNumber v-model="config.biddingRules.argonCirculationGrowthPctMin" :min="0" :dragBy="1" format="percent" class="w-1/2" />
    <span>to</span>
    <InputNumber v-model="config.biddingRules.argonCirculationGrowthPctMax" :min="config.biddingRules.argonCirculationGrowthPctMin" :dragBy="1" format="percent" class="w-1/2" />
  </div>

  <label class="mt-3 font-bold opacity-60 mb-0.5">
    Growth In Argonot Price
  </label>
  <div class="flex flex-row items-center gap-2 w-full">
    <InputNumber v-model="config.biddingRules.micronotPriceChangePctMin" :min="0" :dragBy="1" format="percent" class="w-1/2" />
    <span>to</span>
    <InputNumber v-model="config.biddingRules.micronotPriceChangePctMax" :min="config.biddingRules.micronotPriceChangePctMin" :dragBy="1" format="percent" class="w-1/2" />
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import InputNumber from '../../components/InputNumber.vue';
import { getCalculator } from '../../stores/mainchain';
import { useConfig } from '../../stores/config';

const config = useConfig();
const calculator = getCalculator();
</script>
