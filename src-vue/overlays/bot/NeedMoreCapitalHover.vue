<template>
  <HoverCardRoot v-model:open="hoverState">
    <HoverCardTrigger
      class="inline-block cursor-pointer rounded-full shadow-sm outline-none focus:shadow-[0_0_0_2px] focus:shadow-green-800"
    >
      <AlertIcon class="relative -top-2 mr-2 inline-block h-10 w-10 text-yellow-700" />
    </HoverCardTrigger>
    <HoverCardPortal>
      <HoverCardContent
        class="data-[side=bottom]:animate-slideUpAndFade data-[side=right]:animate-slideLeftAndFade data-[side=left]:animate-slideRightAndFade data-[side=top]:animate-slideDownAndFade z-100 w-[300px] rounded-xl border bg-white p-5 shadow-sm data-[state=open]:transition-all"
        :side-offset="5"
      >
        <p>
          You need a minimum of {{ microgonToArgonNm(minimumCapitalCommitment).format('0,0.[00]') }} argons to win your
          goal of {{ config.biddingRules.seatGoalCount }} seats.
        </p>
        <p>
          Ideally you would commit {{ microgonToArgonNm(idealCapitalCommitment).format('0,0.[00]') }} argons to win your
          goal of {{ config.biddingRules.seatGoalCount }} seats.
        </p>
        <HoverCardArrow class="-mt-[1px] fill-white stroke-gray-300" :width="12" :height="6" />
      </HoverCardContent>
    </HoverCardPortal>
  </HoverCardRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { HoverCardArrow, HoverCardContent, HoverCardPortal, HoverCardRoot, HoverCardTrigger } from 'reka-ui';
import AlertIcon from '../../assets/alert.svg?component';
import BiddingCalculator from '@argonprotocol/commander-core';
import { useConfig } from '../../stores/config';
import { useCurrency } from '../../stores/currency';
import { createNumeralHelpers } from '../../lib/numeral';

const props = defineProps<{
  calculator: BiddingCalculator;
}>();

const config = useConfig();
const currency = useCurrency();

const { microgonToArgonNm } = createNumeralHelpers(currency);

const minimumCapitalCommitment = Vue.computed(
  () => props.calculator.minimumBidAmount * BigInt(config.biddingRules.seatGoalCount),
);
const idealCapitalCommitment = Vue.computed(
  () => props.calculator.maximumBidAmount * BigInt(config.biddingRules.seatGoalCount),
);

const hoverState = Vue.ref(false);
</script>
