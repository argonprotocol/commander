<!-- prettier-ignore -->
<template>
  <Popover as="div" class="relative">
    <PopoverButton class="focus:outline-none">
      <slot>
        <span class="border border-argon-300 text-center text-lg font-bold mt-10 whitespace-nowrap text-argon-600 px-7 py-2 rounded cursor-pointer hover:bg-argon-50/40 hover:border-argon-600 transition-all duration-300">
          View Active Bids
        </span>
      </slot>
    </PopoverButton>
    <PopoverPanel as="div" class="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 cursor-default w-160 h-120 text-center text-lg font-bold mt-10 bg-white rounded-lg shadow-lg border border-gray-300">
      <div class="absolute top-full left-1/2 -translate-x-1/2 w-[30px] h-[15px] rotate-180 overflow-hidden">
        <div class="relative top-[5px] left-[5px] w-[20px] h-[20px] rotate-45 bg-white ring-1 ring-gray-900/20"></div>
      </div>
      <div class="text-center text-base px-6 pt-5 pb-3 h-full">
        <table class="w-full h-full">
          <thead class="font-bold">
            <tr>
              <th class="text-left pb-2">#</th>
              <th class="text-left pb-2">Amount</th>
              <th class="text-left pb-2">Bid Submitted</th>
              <th class="text-right pb-2">Bidding Account</th>
            </tr>
          </thead>
          <tbody class="font-light font-mono">
            <tr v-for="(bid, index) in winningBids" :key="bid.address">
              <td class="text-left opacity-50">{{ index + 1 }})</td>
              <td class="text-left">{{ currency.symbol }}{{ formatMicrogonsBid(bid.microgonsBid) }}</td>
              <td class="text-left">{{ lastBidAtTickFromNow(bid.lastBidAtTick) }}</td>
              <td class="text-right relative">
                {{ bid.address.slice(0, 10) }}...{{ bid.address.slice(-7) }}
                <span
                  v-if="bid.subAccountIndex !== undefined"
                  class="absolute right-0 top-1/2 -translate-y-1/2 bg-argon-600 text-white px-1.5 pb-0.25 rounded text-sm"
                >
                  YOU
                  <span
                    class="absolute top-0 -left-3 inline-block h-full bg-gradient-to-r from-transparent to-white w-3"
                  ></span>
                </span>
              </td>
            </tr>
            <tr v-for="i in 10 - winningBids.length" :key="i">
              <td class="text-left">{{ winningBids.length + i }}</td>
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
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useCurrency } from '../stores/currency';
import { getMainchain } from '../stores/mainchain';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
import { useStats } from '../stores/stats';
import { IBidsFile } from '@argonprotocol/commander-bot/src/storage';
import { createNumeralHelpers } from '../lib/numeral';

dayjs.extend(utc);
dayjs.extend(relativeTime);

const props = defineProps<{
  loadFromMainchain: boolean;
}>();

const stats = useStats();
const currency = useCurrency();
const mainchain = getMainchain();

const { microgonToMoneyNm } = createNumeralHelpers(currency);

const winningBids = Vue.computed<IBidsFile['winningBids']>(() => stats.winningBids);

function formatMicrogonsBid(microgonsBid: bigint | undefined): string {
  if (!microgonsBid) return '---';
  return microgonToMoneyNm(microgonsBid).format('0,0.00');
}

function lastBidAtTickFromNow(lastBidAtTick: number | undefined): string {
  if (!lastBidAtTick) return '---';
  return dayjs.utc(lastBidAtTick * 60_000).fromNow();
}

Vue.onMounted(async () => {
  if (props.loadFromMainchain) {
    const winningBids = await mainchain.fetchWinningBids();
    stats.winningBids = winningBids;
  }
});
</script>

<style scoped>
@reference "../main.css";

th,
td {
  @apply border-b border-gray-300;
}

tbody tr:last-child {
  th,
  td {
    @apply border-b-0;
  }
}
</style>
