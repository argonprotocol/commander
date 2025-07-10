<!-- prettier-ignore -->
<template>
  <div class="CapitalToCommit Component">
    <InputArgon InputArgonWrapper v-model="config.biddingRules.requiredMicrogons" :min="1n" class="w-full" />
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { BidAmountAdjustmentType, BidAmountFormulaType } from '@argonprotocol/commander-calculator/src/IBiddingRules';
import { type IOption } from '../../components/InputMenu.vue';
import InputArgon from '../../components/InputArgon.vue';
import { getCalculator } from '../../stores/mainchain';
import { useConfig } from '../../stores/config';

const config = useConfig();
</script>

<style>
@reference "../../main.css";

.CapitalToCommit.Component {
  [InputArgonWrapper] [inputfield] {
    @apply text-4xl font-bold font-mono text-argon-600;
  }
}
</style>
