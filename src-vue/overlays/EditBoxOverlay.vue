<template>
  <div class="absolute w-[120%] bg-white border border-slate-400 rounded shadow-md z-50">
    <div class="flex flex-col">
      <div class="text-xl font-bold text-slate-800/70 pt-4 pb-2 text-center">{{ titles[id] }}</div>

      <div class="flex flex-col grow text-md px-5">
        <StartingBid v-if="id === 'startingBidAmount'" />
      </div>

      <div class="flex flex-row justify-end pb-3 pr-3 space-x-3 mt-3 mx-2 border-t border-slate-400/50 pt-3">
        <button @click="closeOverlay" class="text-slate-800/70 border border-slate-400 px-3 rounded-md">Cancel</button>
        <button class="text-white bg-argon-button border border-argon-600 px-3 rounded-md">Save</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import StartingBid from './edit-box/StartingBid.vue';

const props = defineProps<{
  id: IEditBoxOverlayType;
}>();

const emit = defineEmits<{
  (e: 'close', id: IEditBoxOverlayType): void;
}>();

export type IEditBoxOverlayTypeForMining =
  | 'startingBidAmount'
  | 'rebidStrategy'
  | 'maximumBid'
  | 'throttleStrategy'
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

const titles = {
  startingBidAmount: 'Starting Bid',
  rebidStrategy: 'Rebid Strategy',
  maximumBid: 'Maximum Bid',
  throttleStrategy: 'Throttle Strategy',
  operationalLongevity: 'Operational Longevity',
  cloudMachine: 'Cloud Machine',
};

function closeOverlay() {
  emit('close', props.id);
}
</script>
