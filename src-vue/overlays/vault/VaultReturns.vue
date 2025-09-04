<template>
  <TooltipProvider :disableHoverableContent="true" :delayDuration="0">
    <TooltipRoot>
      <TooltipTrigger asChild>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side-offset="-5"
          :align-offset="alignOffset ?? 0"
          side="bottom"
          :align="props.align ?? 'center'"
          class="text-md data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade data-[state=delayed-open]:data-[side=right]:animate-slideLeftAndFade data-[state=delayed-open]:data-[side=left]:animate-slideRightAndFade data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade pointer-events-none z-100 rounded-lg border border-gray-800/20 bg-white px-5 pt-4 pb-2 text-left leading-5.5 text-gray-600 shadow-xl will-change-[transform,opacity]"
          :style="{ width: props.width }"
        >
          <p class="min-h-26"></p>
          <TooltipArrow :width="24" :height="12" class="fill-white stroke-gray-400/50 shadow-2xl" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useConfig } from '../../stores/config';
import { useCurrency } from '../../stores/currency';
import numeral, { createNumeralHelpers } from '../../lib/numeral';
import { TooltipArrow, TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui';
import { IBiddingRules } from '@argonprotocol/commander-core';
import { getCalculator, getCalculatorData } from '../../stores/mainchain';

const props = withDefaults(
  defineProps<{
    align?: 'start' | 'end' | 'center';
    alignOffset?: number;
    width?: string;
  }>(),
  {
    width: '700px',
  },
);

const calculator = getCalculator();
const calculatorData = getCalculatorData();

const config = useConfig();
const currency = useCurrency();
const { microgonToMoneyNm, microgonToArgonNm, micronotToArgonotNm } = createNumeralHelpers(currency);

const rules = Vue.computed(() => config.biddingRules as IBiddingRules);

const maximumBidAtSlowGrowthAPY = Vue.ref(0);
const maximumBidAtMediumGrowthAPY = Vue.ref(0);
const maximumBidAtFastGrowthAPY = Vue.ref(0);
const minimumBidAtSlowGrowthAPY = Vue.ref(0);
const minimumBidAtMediumGrowthAPY = Vue.ref(0);
const minimumBidAtFastGrowthAPY = Vue.ref(0);

const maximumBidAmount = Vue.ref(0n);
const minimumBidAmount = Vue.ref(0n);

function updateAPYs() {
  calculator.updateBiddingRules(rules.value);
  calculator.calculateBidAmounts();

  maximumBidAmount.value = calculator.maximumBidAmount;
  minimumBidAmount.value = calculator.minimumBidAmount;

  maximumBidAtSlowGrowthAPY.value = calculator.maximumBidAtSlowGrowthAPY;
  maximumBidAtMediumGrowthAPY.value = (calculator.maximumBidAtSlowGrowthAPY + calculator.maximumBidAtFastGrowthAPY) / 2;
  maximumBidAtFastGrowthAPY.value = calculator.maximumBidAtFastGrowthAPY;
  minimumBidAtSlowGrowthAPY.value = calculator.minimumBidAtSlowGrowthAPY;
  minimumBidAtMediumGrowthAPY.value = (calculator.minimumBidAtSlowGrowthAPY + calculator.minimumBidAtFastGrowthAPY) / 2;
  minimumBidAtFastGrowthAPY.value = calculator.minimumBidAtFastGrowthAPY;
}

Vue.onMounted(() => {
  calculatorData.isInitializedPromise.then(() => {
    updateAPYs();
  });
});
</script>

<style scoped>
@reference "../../main.css";

table td {
  @apply py-2;
}

p {
  @apply mb-4;
}
</style>
