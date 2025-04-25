<template>
  <Popover class="relative pointer-events-auto" v-slot="{ open: isOpen }">
    <PopoverButton class="flex flex-row items-center justify-center text-sm/6 font-semibold text-gray-900 cursor-pointer hover:bg-slate-400/10 px-3 h-[30px] focus:outline-none" :class="[ isOpen ? `${buttonBorderProperty} ${buttonBgProperty}` : `border-transparent hover:${buttonBorderProperty} hover:${buttonBgProperty}` ]">
      <ArgonSign v-if='configStore.displayCurrency.id === "ARGN"' class="h-[14px]" />
      <DollarSign v-else-if='configStore.displayCurrency.id === "USD"' class="h-[18px]" />
      <EuroSign v-else-if='configStore.displayCurrency.id === "EURO"' class="h-[18px]" />
      <PoundSign v-else-if='configStore.displayCurrency.id === "GBP"' class="h-[18px]" />
      <RupeeSign v-else-if='configStore.displayCurrency.id === "INR"' class="h-[18px]" />
    </PopoverButton>

    <transition enter-active-class="transition ease-out duration-200" enter-from-class="opacity-0 translate-y-1" enter-to-class="opacity-100 translate-y-0" leave-active-class="transition ease-in duration-150" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 translate-y-1">
      <PopoverPanel v-slot="{ close }" ref="popoverElem" class="absolute -right-3 z-100 mt-2 flex w-screen max-w-min">
        <div class="absolute -top-[15px] right-3 w-[30px] h-[15px] overflow-hidden">
          <div class="relative top-[5px] left-[5px] w-[20px] h-[20px] rotate-45 bg-white ring-1 ring-gray-900/20"></div>
        </div>
        <div class="flex flex-col p-1 shrink rounded bg-white text-sm/6 font-semibold text-gray-900 shadow-lg ring-1 ring-gray-900/20">
          <a v-for="(record, key) of configStore.displayCurrencies as Record<ICurrency, ICurrencyRecord>" :key="key" @click="() => { setDisplayCurrency(key); close(); }" class="flex flex-row justify-between py-1 px-2 !text-gray-900 hover:!text-indigo-600 hover:bg-argon-menu-hover cursor-pointer">
            <span class="font-medium opacity-30 mr-4">{{record.name}}</span>
            <span class="w-8 text-center" v-html="record.symbol"></span>
          </a>
        </div>
      </PopoverPanel>
    </transition>
  </Popover>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { ICurrencyRecord, useConfigStore, type ICurrency } from '../stores/config';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
import ArgonSign from '../assets/currencies/argon.svg';
import DollarSign from '../assets/currencies/dollar.svg';
import EuroSign from '../assets/currencies/euro.svg';
import PoundSign from '../assets/currencies/pound.svg';
import RupeeSign from '../assets/currencies/rupee.svg';

const props = defineProps({
  isDark: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['currencyMenuIsOpen']);

const popoverElem = Vue.ref<{ el: HTMLElement | null }>({ el: null });

const buttonBorderProperty = props.isDark ? 'border-slate-500/70' : 'border-slate-400/50';
const buttonBgProperty = props.isDark ? 'bg-[#D6D9DF]' : 'bg-transparent';

const configStore = useConfigStore();
const { setDisplayCurrency } = configStore;

Vue.watch(() => popoverElem.value?.el, (el) => emit('currencyMenuIsOpen', !!el));
</script>