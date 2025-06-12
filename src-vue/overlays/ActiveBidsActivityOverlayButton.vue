<template>
  <Popover as="div" class="relative text-center text-lg font-bold mt-10">
    <PopoverButton
      class="focus:outline-none border border-argon-300 whitespace-nowrap text-argon-600 px-7 py-2 rounded cursor-pointer hover:bg-argon-50/40 hover:border-argon-600 transition-all duration-300"
    >
      View Bidding Activity
    </PopoverButton>
    <PopoverPanel
      as="div"
      class="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 cursor-default w-160 h-120 bg-white rounded-lg shadow-lg border border-gray-300"
    >
      <div
        class="absolute top-full left-1/2 -translate-x-1/2 w-[30px] h-[15px] rotate-180 overflow-hidden"
      >
        <div
          class="relative top-[5px] left-[5px] w-[20px] h-[20px] rotate-45 bg-white ring-1 ring-gray-900/20"
        ></div>
      </div>
      <div class="text-center text-base px-6 pt-5 pb-3 h-full">
        <table class="w-full h-full">
          <thead class="font-bold">
            <tr>
              <th class="text-left"></th>
              <th class="text-left">Bid Amount</th>
              <th class="text-left">Submitted</th>
              <th class="text-right">Account</th>
            </tr>
          </thead>
          <tbody class="font-light font-mono">
            <tr v-for="(bid, index) in allBids" :key="bid.accountId">
              <td class="text-left">{{ index + 1 }}</td>
              <td class="text-left">
                {{ currencySymbol }}{{ fmtMoney(currencyStore.argonTo(bid.amount)) }}
              </td>
              <td class="text-left">recently</td>
              <td class="text-right relative">
                {{ bid.accountId.slice(0, 10) }}...{{ bid.accountId.slice(-7) }}
                <span
                  v-if="bid.isMine"
                  class="absolute right-0 top-1/2 -translate-y-1/2 bg-argon-600 text-white px-1.5 pb-0.25 rounded text-sm"
                  >YOU<span
                    class="absolute top-0 -left-3 inline-block h-full bg-gradient-to-r from-transparent to-white w-3"
                  ></span
                ></span>
              </td>
            </tr>
            <tr v-for="i in 10 - allBids.length" :key="i">
              <td class="text-left">{{ allBids.length + i }}</td>
              <td class="text-left text-gray-400">---</td>
              <td class="text-left text-gray-400">---</td>
              <td class="text-right text-gray-400">-------------</td>
            </tr>
          </tbody>
        </table>
      </div>
    </PopoverPanel>
  </Popover>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { storeToRefs } from 'pinia';
import { useCurrencyStore } from '../stores/currency';
import { fmtMoney } from '../lib/Utils';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';

const currencyStore = useCurrencyStore();
const { currencySymbol } = storeToRefs(currencyStore);

const allBids = Vue.ref([]);
</script>
