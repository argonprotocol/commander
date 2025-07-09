<!-- prettier-ignore -->
<template>
  <div class="absolute w-[120%] bg-white border border-slate-500/60 rounded-md shadow-lg z-50">
    <div class="flex flex-col">
      <div class="text-xl font-bold text-slate-800/70 mx-2 pt-4 pb-1 text-center border-b border-slate-400/50">
        {{ titles[id as keyof typeof titles] }}
      </div>

      <div class="flex flex-col grow text-md px-5 mt-4">
        <StartingBid v-if="id === 'startingBidAmount'" />
      </div>

      <div class="flex flex-row justify-end pb-3 pr-3 space-x-3 mt-5 mx-2 border-t border-slate-400/50 pt-3">
        <button @click="cancelOverlay" class="text-slate-800/70 border border-slate-400 px-3 rounded-md cursor-pointer">Cancel</button>
        <button @click="saveOverlay" class="text-white bg-argon-button border border-argon-600 px-3 rounded-md cursor-pointer">Save</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import StartingBid from './edit-box/StartingBid.vue';
import { useConfig } from '../stores/config';
import { jsonParseWithBigInts, jsonStringifyWithBigInts } from '../lib/Utils';
import { IBiddingRules } from '@argonprotocol/commander-calculator';

const props = defineProps<{
  id: IEditBoxOverlayType;
}>();

const emit = defineEmits<{
  (e: 'close', id: IEditBoxOverlayType): void;
}>();

export type IEditBoxOverlayTypeForMining =
  | 'startingBidAmount'
  | 'rebiddingStrategy'
  | 'maximumBid'
  | 'seatGoals'
  | 'operationalLongevity'
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
  startingBidAmount: 'Starting Bid',
  rebiddingStrategy: 'Rebidding Strategy',
  maximumBid: 'Maximum Bid',
  seatGoals: 'Seat Goals',
  operationalLongevity: 'Operational Longevity',
  cloudMachine: 'Cloud Machine',
};

function cancelOverlay() {
  config.biddingRules = jsonParseWithBigInts(previousBiddingRules) as IBiddingRules;
  emit('close', props.id);
}

function saveOverlay() {
  emit('close', props.id);
}
</script>
