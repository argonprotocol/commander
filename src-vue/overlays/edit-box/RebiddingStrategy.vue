<!-- prettier-ignore -->
<template>
  <p class="text-md mb-3">
    As your bot monitors your active bids, if you're outbid, it will automatically rebid to keep you in play.
  </p>

  <label class="mt-3 font-bold opacity-60 mb-0.5">
    Increment By
  </label>
  <InputArgon v-model="config.biddingRules.rebiddingIncrementBy" :min="1n" :dragBy="1n" format="integer" class="w-full" />

  <label class="mt-3 font-bold opacity-60 mb-0.5">
    Delay Between Bids
  </label>
  <InputNumber v-model="config.biddingRules.rebiddingDelay" :min="1" :dragBy="1" format="minutes" class="w-full" />
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import InputNumber from '../../components/InputNumber.vue';
import InputArgon from '../../components/InputArgon.vue';
import { getCalculator } from '../../stores/mainchain';
import { useConfig } from '../../stores/config';

const config = useConfig();
const calculator = getCalculator();
</script>
