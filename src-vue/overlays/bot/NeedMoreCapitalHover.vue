<template>
  <HoverCardRoot v-model:open="hoverState">
    <HoverCardTrigger
      class="inline-block cursor-pointer rounded-full outline-none focus:shadow-[0_0_0_2px] focus:shadow-green-800 shadow-sm"
    >
      <AlertIcon class="w-10 h-10 text-yellow-700 inline-block relative -top-2 mr-2" />
    </HoverCardTrigger>
    <HoverCardPortal>
      <HoverCardContent
        class="z-100 data-[side=bottom]:animate-slideUpAndFade data-[side=right]:animate-slideLeftAndFade data-[side=left]:animate-slideRightAndFade data-[side=top]:animate-slideDownAndFade w-[300px] rounded-xl bg-white p-5 data-[state=open]:transition-all border shadow-sm"
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
        <HoverCardArrow class="fill-white stroke-gray-300 -mt-[1px]" :width="12" :height="6" />
      </HoverCardContent>
    </HoverCardPortal>
  </HoverCardRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { HoverCardArrow, HoverCardContent, HoverCardPortal, HoverCardRoot, HoverCardTrigger } from 'reka-ui';
import AlertIcon from '../../assets/alert.svg?component';
import BiddingCalculator from '@argonprotocol/commander-calculator';
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
