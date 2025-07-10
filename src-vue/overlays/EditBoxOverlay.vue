<!-- prettier-ignore -->
<template>
  <div class="absolute w-[120%] bg-white border border-slate-500/60 rounded-md shadow-lg z-50 text-base">
    <div class="flex flex-col">
      <div class="text-xl font-bold font-sans text-argon-600/70 mx-2 pt-4 pb-1 text-center border-b border-slate-400/50">
        {{ titles[id as keyof typeof titles] }}
      </div>

      <div class="flex flex-col grow text-md px-5 mt-4">
        <CapitalToCommit v-if="id === 'capitalToCommit'" />
        <StartingBid v-if="id === 'startingBid'" />
        <MaximumBid v-if="id === 'maximumBid'" />
        <RebiddingStrategy v-if="id === 'rebiddingStrategy'" />
        <SeatingGoal v-if="id === 'seatGoals'" />
        <ExpectedGrowth v-if="id === 'expectedGrowth'" />
        <CloudMachine v-if="id === 'cloudMachine'" />
      </div>

      <div v-if="hideSaveButton" class="flex flex-row justify-end pb-3 pr-3 space-x-3 mt-5 mx-2 border-t border-slate-400/50 pt-3">
        <button @click="cancelOverlay" class="text-slate-800/70 border border-slate-400 px-3 rounded-md cursor-pointer">Close</button>
      </div>
      <div v-else class="flex flex-row justify-end pb-3 pr-3 space-x-3 mt-5 mx-2 border-t border-slate-400/50 pt-3">
        <button @click="cancelOverlay" class="text-slate-800/70 border border-slate-400 px-3 rounded-md cursor-pointer">Cancel</button>
        <button @click="saveOverlay" class="text-white bg-argon-button border border-argon-600 px-3 rounded-md cursor-pointer">Save</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import CapitalToCommit from './edit-box/CapitalToCommit.vue';
import StartingBid from './edit-box/StartingBid.vue';
import MaximumBid from './edit-box/MaximumBid.vue';
import RebiddingStrategy from './edit-box/RebiddingStrategy.vue';
import SeatingGoal from './edit-box/SeatingGoal.vue';
import ExpectedGrowth from './edit-box/ExpectedGrowth.vue';
import CloudMachine from './edit-box/CloudMachine.vue';
import { useConfig } from '../stores/config';
import { jsonParseWithBigInts, jsonStringifyWithBigInts } from '../lib/Utils';
import { IBiddingRules } from '@argonprotocol/commander-calculator';

const props = defineProps<{
  id: IEditBoxOverlayType;
  hideSaveButton?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close', id: IEditBoxOverlayType): void;
}>();

export type IEditBoxOverlayTypeForMining =
  | 'capitalToCommit'
  | 'maximumBid'
  | 'startingBid'
  | 'rebiddingStrategy'
  | 'seatGoals'
  | 'expectedGrowth'
  | 'cloudMachine';
export type IEditBoxOverlayTypeForVault =
  | 'capitalDistribution'
  | 'securitizationRatio'
  | 'externalProfitSharing'
  | 'btcFlatFee'
  | 'btcVariableFee'
  | 'personalBtc';
export type IEditBoxOverlayType = IEditBoxOverlayTypeForMining | IEditBoxOverlayTypeForVault;

const config = useConfig();

let previousBiddingRules = jsonStringifyWithBigInts(config.biddingRules);

const titles = {
  capitalToCommit: 'Capital to Commit',
  maximumBid: 'Maximum Bid',
  startingBid: 'Starting Bid',
  rebiddingStrategy: 'Rebidding Strategy',
  seatGoals: 'Seat Goals',
  expectedGrowth: 'Expected Growth',
  cloudMachine: 'Cloud Machine',
};

function cancelOverlay(e?: MouseEvent) {
  config.biddingRules = jsonParseWithBigInts(previousBiddingRules) as IBiddingRules;
  emit('close', props.id);
  e?.preventDefault();
  e?.stopPropagation();
}

function saveOverlay() {
  emit('close', props.id);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    cancelOverlay();
  }
}

Vue.onBeforeMount(async () => {
  window.addEventListener('keydown', handleKeydown);
});

Vue.onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>
