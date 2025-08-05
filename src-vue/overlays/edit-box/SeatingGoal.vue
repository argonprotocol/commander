<!-- prettier-ignore -->
<template>
  <p class="text-md mb-3">
    These goals are used to guide your bot's bidding strategy. In the world of Argon, frames are equivalent to a day, and epochs are equivalent to ten days.
  </p>

  <label class="mt-3 font-bold opacity-60 mb-0.5">
    Quantity to Win
  </label>
  <div class="flex flex-row items-center gap-2 w-full">
    <InputNumber v-model="config.biddingRules.seatGoalCount" :min="0" suffix=" Seats" :dragBy="1" class="w-1/2" />
    <InputMenu v-model="config.biddingRules.seatGoalInterval" :options="[
        { name: `Per ${SeatGoalInterval.Epoch}`, value: SeatGoalInterval.Epoch },
        { name: `Per ${SeatGoalInterval.Frame}`, value: SeatGoalInterval.Frame }
      ]" :selectFirst="true" class="w-1/2" />
  </div>

  <label class="mt-3 font-bold opacity-60 mb-0.5">
    Throttle Type
  </label>
  <div class="flex flex-row items-center gap-2 w-full">
    <InputMenu v-model="config.biddingRules.seatGoalType" :options="[
        { name: `Get As Many Seats As Possible`, value: SeatGoalType.Min },
        { name: `Stop Bidding After Goal Reached`, value: SeatGoalType.Max }
      ]" :selectFirst="true" class="w-full" />
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import InputNumber from '../../components/InputNumber.vue';
import InputMenu from '../../components/InputMenu.vue';
import { getCalculator } from '../../stores/mainchain';
import { useConfig } from '../../stores/config';
import { SeatGoalInterval, SeatGoalType } from '@argonprotocol/commander-calculator/src/IBiddingRules';

const config = useConfig();
const calculator = getCalculator();
</script>
