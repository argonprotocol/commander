<template>
  <InputNumber
    v-bind="$attrs"
    format="integer"
    :prefix="prefix"
    :dragBy="dragBy"
    :dragByMin="dragByMin"
    :disabled="props.disabled"
    :alwaysShowDecimals="props.alwaysShowDecimals"
    :options="props.options"
    :model-value="modelValue"
    @update:model-value="handleUpdate"
  />
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useCurrency } from '../stores/currency';
import InputNumber from './InputNumber.vue';
import BigNumber from 'bignumber.js';
import { MICROGONS_PER_ARGON } from '@argonprotocol/commander-calculator/src/Mainchain';

const currency = useCurrency();

const props = withDefaults(
  defineProps<{
    modelValue: bigint;
    max?: bigint;
    min?: bigint;
    options?: any[];
    dragBy?: bigint;
    dragByMin?: bigint;
    disabled?: boolean;
    alwaysShowDecimals?: boolean;
    prefix?: string;
  }>(),
  {
    options: () => [],
    dragBy: () => 1n * BigInt(MICROGONS_PER_ARGON),
    dragByMin: () => BigInt(Math.floor(0.01 * MICROGONS_PER_ARGON)),
    disabled: false,
    alwaysShowDecimals: true,
    prefix: '',
  },
);

const prefix = Vue.computed(() => {
  return (props.prefix || '') + currency.symbol;
});

const modelValue = Vue.computed(() => {
  return BigNumber(props.modelValue).dividedBy(MICROGONS_PER_ARGON).toNumber();
});

const dragBy = Vue.computed<number | undefined>(() => {
  if (!props.dragBy) return undefined;
  return BigNumber(props.dragBy).dividedBy(MICROGONS_PER_ARGON).toNumber();
});

const dragByMin = Vue.computed<number | undefined>(() => {
  if (!props.dragByMin) return undefined;
  return BigNumber(props.dragByMin).dividedBy(MICROGONS_PER_ARGON).toNumber();
});

const emit = defineEmits(['update:modelValue']);

const handleUpdate = (value: number) => {
  const valueBn = BigNumber(value).multipliedBy(MICROGONS_PER_ARGON);
  emit('update:modelValue', BigInt(valueBn.integerValue().toString()));
};
</script>
