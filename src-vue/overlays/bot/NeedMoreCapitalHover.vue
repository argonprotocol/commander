<template>
  <HoverCardRoot v-model:open="hoverState">
    <HoverCardTrigger class="inline-block cursor-pointer outline-none">
      <AlertIcon class="relative -top-2 mr-2 inline-block h-10 w-10 text-yellow-700" />
    </HoverCardTrigger>
    <HoverCardPortal>
      <HoverCardContent
        class="data-[side=bottom]:animate-slideUpAndFade data-[side=right]:animate-slideLeftAndFade data-[side=left]:animate-slideRightAndFade data-[side=top]:animate-slideDownAndFade text-md z-100 w-[500px] rounded-md border border-gray-800/20 bg-white px-4 pt-4 pb-5 text-left leading-5.5 text-gray-600 shadow-xl select-none data-[state=open]:transition-all"
        align="start"
        :alignOffset="-50"
        :sideOffset="5"
      >
        <p>
          You need to commit a minimum of {{ currency.symbol
          }}{{ microgonToMoneyNm(idealCapitalCommitment).format('0,0.[00]') }} in order to have a chance at your goal of
          winning {{ config.biddingRules.seatGoalCount }} seats.
        </p>
        <button
          @click="increaseCapitalCommitment"
          class="border-argon-600/30 mt-4 flex cursor-pointer flex-row items-center rounded-md border bg-slate-200 px-4 py-1.5 font-bold"
        >
          <IncreaseIcon class="relative -mt-0.5 mr-2 inline-block size-4" />
          <span class="text-lg">
            Increase to {{ currency.symbol }}{{ microgonToMoneyNm(idealCapitalCommitment).format('0,0.[00]') }}
          </span>
        </button>
        <HoverCardArrow :width="24" :height="12" class="-mt-px ml-1.5 fill-white stroke-gray-400/30" />
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
import IncreaseIcon from '../../assets/increase.svg?component';

const props = defineProps<{
  calculator: BiddingCalculator;
}>();

const config = useConfig();
const currency = useCurrency();

const { microgonToMoneyNm } = createNumeralHelpers(currency);

const idealCapitalCommitment = Vue.computed(() => {
  const minimumCapitalNeeded = props.calculator.maximumBidAmount * BigInt(config.biddingRules.seatGoalCount);
  const minimumCapitalNeededRoundedUp = Math.ceil(Number(minimumCapitalNeeded) / 1_000_000) * 1_000_000;
  return BigInt(minimumCapitalNeededRoundedUp);
});

function increaseCapitalCommitment() {
  config.biddingRules.baseCapitalCommitment = idealCapitalCommitment.value;
}

const hoverState = Vue.ref(false);
</script>
