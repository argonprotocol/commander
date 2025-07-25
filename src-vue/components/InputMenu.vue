<!-- prettier-ignore -->
<template>
  <Listbox as="div" ref="$el" class="flex relative grow">
    <div class="relative grow focus-within:relative">
      <div class="font-mono flex flex-row items-center select-none text-md w-full pl-6 pr-2 py-1 border invisible whitespace-nowrap">
        <div>{{ longestOption.name }}</div>
        <div v-if="longestOption?.microgons" class="whitespace-nowrap pl-6 pr-2 text-right opacity-60">{{currency.symbol}}{{ microgonToMoneyNm(longestOption!.microgons).format('0,0.00') }}</div>
        <div class="size-4"></div>
      </div>
      <ListboxButton as="div" @click="toggleMenu"
        :class="props.disabled ? 'cursor-default border-dashed' : 'cursor-pointer hover:bg-white'"
        class="flex flex-row items-center font-mono absolute top-0 left-0 right-0 bottom-0 select-none text-md w-full pl-2 pr-2 text-left py-1 focus:bg-slate-500/5 border border-slate-700/40 rounded-md text-gray-800 focus:outline-2 focus:-outline-offset-2 focus:outline-yellow-600"
      >
        <div :class="props.disabled ? 'opacity-80' : ''" class="flex flex-row grow items-center justify-between whitespace-nowrap">
          {{ selectedOption?.name }}
        </div>
        <div v-if="selectedOption?.microgons" class="whitespace-nowrap pl-1 pr-2 text-right opacity-60">{{currency.symbol}}{{ microgonToMoneyNm(selectedOption!.microgons).format('0,0.00') }}</div>
        <div class="relative size-4">
          <ChevronUpIcon v-if="showMenu" class="size-4 text-gray-400" />
          <ChevronDownIcon v-else class="size-4 text-gray-400" />
        </div>
      </ListboxButton>

      <ListboxOptions v-if="showMenu"
        class="absolute top-full -translate-y-0.5 z-30 left-0 right-0 overflow-y-auto h-auto max-h-80 bg-argon-menu-bg border border-gray-300 rounded-b-md px-0.5 shadow-md focus:outline-none"
      >
        <ListboxOption
          v-for="option of options"
          v-slot="{ active: isActive }"
          :value="option.value"
          @click.stop="selectOption(option)"
          class="font-mono cursor-default text-md text-left text-gray-800 py-0.5"
        >
          <div
            :class="[isActive ? 'bg-argon-button text-white' : '']"
            class="flex flex-col pr-3 pl-1 py-0.5 rounded-xs"
          >
            <div class="flex flex-row items-center justify-between">
              <div class="size-4">
              <CheckIcon
                :class="[option.value === modelValue ? 'opacity-100' : 'opacity-0']"
                class="size-4 text-white-400 block"
              />
              </div>
              <div class="whitespace-nowrap grow pl-1">{{ option.name }}</div>
              <div v-if="option.microgons" class="whitespace-nowrap pl-1 text-right opacity-60">{{currency.symbol}}{{ microgonToMoneyNm(option.microgons!).format('0,0.00') }}</div>
              <div v-else-if="hasPrices" class="whitespace-nowrap pl-1 text-right opacity-60">{{currency.symbol}}---.--</div>
            </div>
          </div>
        </ListboxOption>
      </ListboxOptions>
    </div>
  </Listbox>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { ChevronDownIcon, ChevronUpIcon, CheckIcon } from '@heroicons/vue/24/outline';
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/vue';
import { useCurrency } from '../stores/currency';
import { createNumeralHelpers } from '../lib/numeral';

const currency = useCurrency();
const { microgonToMoneyNm } = createNumeralHelpers(currency);

export type IOption = { name?: string; value: string; microgons?: bigint };

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    options: IOption[] | IOption;
    disabled?: boolean;
  }>(),
  {
    disabled: false,
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const showMenu = Vue.ref(false);
const $el = Vue.ref<HTMLElement | null>(null);

const options = (Array.isArray(props.options) ? props.options : [props.options]).map(option => ({
  ...option,
  name: option.name || option.value,
}));
const selectedOption: Vue.Ref<IOption> = Vue.ref(
  options.find(option => option.value === props.modelValue) || options[0],
);
const longestOption = options.reduce((x, option) => (x.name.length >= option.name.length ? x : option), options[0]);
const hasPrices = options.some(option => option.microgons !== undefined);

const value = Vue.computed({
  get: () => props.modelValue,
  set: (value: string | undefined) => {
    if (value === undefined) {
      value = options[0].value;
    }
    emit('update:modelValue', value);
  },
});

function selectOption(option: IOption) {
  showMenu.value = false;
  selectedOption.value = option;
  if (option.value !== undefined) {
    value.value = option.value;
  }
}

function toggleMenu() {
  if (props.disabled) {
    return;
  }
  showMenu.value = !showMenu.value;
}
</script>

<style scoped>
@reference "../main.css";

ul {
  @apply flex flex-col;
}

ul li {
  @apply border-b border-gray-300;
}
</style>
