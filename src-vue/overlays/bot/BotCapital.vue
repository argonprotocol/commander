<template>
  <TooltipProvider :disableHoverableContent="true" :delayDuration="0">
    <TooltipRoot>
      <TooltipTrigger>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side-offset="-5"
          :align-offset="alignOffset ?? 0"
          :align="props.align ?? 'center'"
          side="bottom"
          class="text-md data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade data-[state=delayed-open]:data-[side=right]:animate-slideLeftAndFade data-[state=delayed-open]:data-[side=left]:animate-slideRightAndFade data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade pointer-events-none z-100 rounded-lg border border-gray-800/20 bg-white px-5 pt-4 pb-2 text-left leading-5.5 text-gray-600 shadow-xl will-change-[transform,opacity]"
          :style="{ width: props.width }"
        >
          <p>
            This box contains the number of tokens (both argons and argonots) that are committed to your mining
            operations. Your bidding bot will use these tokens to win mining seats on your behalf. The number of seats
            you win will vary based on how much capital you invest and how many other bidders are competing against you.
          </p>

          <p>
            You can set your Starting Bid and Maximum Bid in the config settings to give your bot a bidding range it
            must stay within.
          </p>

          <p>Below is a breakdown of your estimated seat outcomes over the next ten days.</p>

          <table class="relative z-50 mt-2 h-full w-full table-fixed whitespace-nowrap">
            <tbody>
              <tr class="text-argon-600 h-1/3">
                <td class="w-5/12"></td>
                <td class="text-argon-800/40 w-5/12 text-right font-sans font-light">Seat Goal</td>
                <td class="text-argon-800/40 w-5/12 text-right font-sans font-light">Est. Seats</td>
                <td class="text-argon-800/40 w-5/12 text-right font-sans font-light">Est. Cost</td>
                <td class="text-argon-800/40 w-5/12 text-right font-sans font-light">Est. Earnings</td>
              </tr>
              <tr class="text-argon-600 h-1/3 font-mono font-bold">
                <td
                  class="text-argon-800/40 border-t border-dashed border-slate-300 pr-10 pl-2 text-left font-sans font-light"
                >
                  Maximum Bid ({{ currency.symbol }}{{ microgonToMoneyNm(maximumBidAmount).format('0,0.00') }})
                </td>
                <td class="border-t border-dashed border-slate-300 text-right">
                  {{ rules.seatGoalCount }}
                </td>
                <td class="border-t border-dashed border-slate-300 text-right">
                  {{ probableMinSeats }}
                </td>
                <td class="border-t border-dashed border-slate-300 text-right">
                  {{ currency.symbol }}{{ microgonToMoneyNm(maximumBidSeatsCost).format('0,0.00') }}
                </td>
                <td class="border-t border-dashed border-slate-300 text-right">
                  {{ currency.symbol }}{{ microgonToMoneyNm(maximumBidSeatsEarnings).format('0,0.00') }}
                </td>
              </tr>
              <tr class="text-argon-600 h-1/3 font-mono font-bold">
                <td
                  class="text-argon-800/40 border-t border-dashed border-slate-300 pr-10 pl-2 text-left font-sans font-light"
                >
                  Starting Bid ({{ currency.symbol }}{{ microgonToMoneyNm(minimumBidAmount).format('0,0.00') }})
                </td>
                <td class="border-t border-dashed border-slate-300 text-right">
                  {{ rules.seatGoalCount }}
                </td>
                <td class="border-t border-dashed border-slate-300 text-right">
                  {{ probableMaxSeats }}
                </td>
                <td class="border-t border-dashed border-slate-300 text-right">
                  {{ currency.symbol }}{{ microgonToMoneyNm(minimumBidSeatsCost).format('0,0.00') }}
                </td>
                <td class="border-t border-dashed border-slate-300 text-right">
                  {{ currency.symbol }}{{ microgonToMoneyNm(minimumBidSeatsEarnings).format('0,0.00') }}
                </td>
              </tr>
            </tbody>
          </table>

          <TooltipArrow :width="24" :height="12" class="fill-white stroke-gray-400/50 shadow-2xl" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useCurrency } from '../../stores/currency';
import BigNumber from 'bignumber.js';
import numeral, { createNumeralHelpers } from '../../lib/numeral';
import { TooltipArrow, TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui';
import { getCalculator, getCalculatorData } from '../../stores/mainchain';
import { useConfig } from '../../stores/config';
import { IBiddingRules } from '@argonprotocol/commander-core';

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
const { microgonToMoneyNm } = createNumeralHelpers(currency);

const rules = Vue.computed(() => config.biddingRules as IBiddingRules);

const probableMinSeats = Vue.ref(0);
const probableMaxSeats = Vue.ref(0);

const maximumBidSeatsCost = Vue.ref(0n);
const maximumBidSeatsEarnings = Vue.ref(0n);
const minimumBidSeatsCost = Vue.ref(0n);
const minimumBidSeatsEarnings = Vue.ref(0n);

const maximumBidAmount = Vue.ref(0n);
const minimumBidAmount = Vue.ref(0n);

function updateAPYs() {
  calculator.updateBiddingRules(rules.value);
  calculator.calculateBidAmounts();

  maximumBidAmount.value = calculator.maximumBidAmount;
  minimumBidAmount.value = calculator.minimumBidAmount;

  const probableMinSeatsBn = BigNumber(rules.value.baseCapitalCommitment).dividedBy(calculator.maximumBidAmount);
  probableMinSeats.value = Math.max(probableMinSeatsBn.integerValue(BigNumber.ROUND_FLOOR).toNumber(), 0);

  const probableMaxSeatsBn = BigNumber(rules.value.baseCapitalCommitment).dividedBy(calculator.minimumBidAmount);
  probableMaxSeats.value = Math.min(
    probableMaxSeatsBn.integerValue(BigNumber.ROUND_FLOOR).toNumber(),
    calculatorData.miningSeatCount,
  );

  const averageEarningsPerSeat = (calculator.slowGrowthRewards + calculator.fastGrowthRewards) / 2n;

  maximumBidSeatsCost.value = BigInt(probableMinSeats.value) * calculator.maximumBidAmount;
  maximumBidSeatsEarnings.value = BigInt(probableMinSeats.value) * averageEarningsPerSeat;

  minimumBidSeatsCost.value = BigInt(probableMaxSeats.value) * calculator.minimumBidAmount;
  minimumBidSeatsEarnings.value = BigInt(probableMaxSeats.value) * averageEarningsPerSeat;
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
