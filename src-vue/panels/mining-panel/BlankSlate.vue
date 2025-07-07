<template>
  <div class="flex flex-col h-full">
    <div style="text-shadow: 1px 1px 0 white">
      <div class="text-5xl leading-tight font-bold text-center mt-20 text-[#4B2B4E]">
        Earn Argons and Argonots
        <div>By Running Your Own Mining Node</div>
      </div>
      <p class="text-base text-justify w-[780px] !mx-auto mt-10 text-[#4B2B4E]">
        Argon uses a special auction process to determine who can mine. The winners of each auction hold the right to
        mine for ten days, then it goes back up for bidding. Argon's mining software is runnable on cheap virtual cloud
        machines, which makes getting involved easy and cost-effective. Click the button below to get started.
      </p>
    </div>
    <button
      @click="openConfigureMiningBotOverlay"
      class="bg-argon-500 hover:bg-argon-600 border border-argon-700 inner-button-shadow text-2xl font-bold text-white px-12 py-2 rounded-md mx-auto block mt-10 cursor-pointer"
    >
      Create Personal Mining Bot
    </button>
    <div class="flex-grow flex flex-row items-end w-full">
      <div class="flex flex-col w-full px-5 pb-5">
        <ul
          class="flex flex-row text-center text-sm text-[#4B2B4E] w-full py-7 border-t border-b border-slate-300 mb-5"
        >
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              {{ blockchainStore.miningSeatCount ? numeral(blockchainStore.miningSeatCount).format('0,0') : '---' }}
            </div>
            <div>Mining Seats</div>
          </li>
          <li style="width: 1px" class="bg-slate-300"></li>
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="isLoaded">
                <span :class="[currency.symbol === '₳' ? 'font-semibold' : 'font-bold']">
                  {{ currency.symbol }}
                </span>
                {{ microgonToMoneyNm(blockchainStore.aggregatedBidCosts).formatIfElse('< 1_000', '0,0.00', '0,0') }}
              </template>
              <template v-else>---</template>
            </div>
            <div>Active Pending Bids</div>
          </li>
          <li style="width: 1px" class="bg-slate-300"></li>
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="isLoaded">
                <span :class="[currency.symbol === '₳' ? 'font-semibold' : 'font-bold']">
                  {{ currency.symbol }}
                </span>
                {{ microgonToMoneyNm(aggregatedBlockRewards).formatIfElse('< 1_000', '0,0.00', '0,0') }}
              </template>
              <template v-else>---</template>
            </div>
            <div>Mimimum Pending Rewards</div>
          </li>
          <li style="width: 1px" class="bg-slate-300"></li>
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="isLoaded">{{ numeral(currentAPY).format('0,0') }}%</template>
              <template v-else>---</template>
            </div>
            <div>Annual Percentage Yield</div>
          </li>
        </ul>
        <ul Blocks class="w-full flex flex-row justify-end h-[137px]">
          <template v-for="(block, index) in blocks" :key="`${block.hash}-${index}`">
            <li Block class="leading-6" :class="{ 'opacity-50': !block.hash }">
              <div v-if="block.hash" class="border-b border-slate-300 pb-1 mb-2">
                #
                <span class="font-bold opacity-50">{{ block.number }}</span>
              </div>
              <div v-if="block.hash">{{ block.extrinsics }} txns</div>
              <div v-if="block.hash">{{ microgonToArgonNm(block.microgons).format('0.[00]') }} argons</div>
              <div v-if="block.hash">{{ micronotToArgonotNm(block.micronots).format('0.[00]') }} argonots</div>
            </li>
            <li Connection :class="{ 'opacity-50': !block.hash }"></li>
          </template>
          <li Block class="flex flex-col text-center justify-center items-center">
            <div v-if="blocks[blocks.length - 1].hash" class="flex flex-col text-center justify-center items-center">
              <img src="/mining.gif" class="w-8 inline-block relative -left-1" />
              <div class="flex flex-row justify-center pt-5">
                <div class="flex flex-col items-center leading-none">
                  <div>{{ minutesSinceBlock }}</div>
                  <div>min{{ minutesSinceBlock === 1 ? '' : 's' }}</div>
                </div>
                <div class="h-full w-[1px] bg-slate-300 mx-3"></div>
                <div class="flex flex-col items-center leading-none">
                  <div>{{ secondsSinceBlock }}</div>
                  <div>sec{{ secondsSinceBlock === 1 ? '' : 's' }}</div>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { storeToRefs } from 'pinia';
import emitter from '../../emitters/basic';
import { useBlockchainStore, type IBlock } from '../../stores/blockchain';
import { useCurrency } from '../../stores/currency';
import { calculateAPY } from '../../lib/Utils';
import numeral, { createNumeralHelpers } from '../../lib/numeral';

dayjs.extend(utc);

const blockchainStore = useBlockchainStore();
const currency = useCurrency();

const { cachedBlocks: blocks } = storeToRefs(blockchainStore);
const { microgonToArgonNm, micronotToArgonotNm, microgonToMoneyNm } = createNumeralHelpers(currency);

const minutesSinceBlock = Vue.ref(0);
const secondsSinceBlock = Vue.ref(0);
const isLoaded = Vue.ref(false);

const aggregatedBlockRewards = Vue.computed(() => {
  return (
    blockchainStore.aggregatedBlockRewards.microgons +
    currency.micronotToMicrogon(blockchainStore.aggregatedBlockRewards.micronots)
  );
});

const currentAPY = Vue.computed(() => {
  return calculateAPY(blockchainStore.aggregatedBidCosts, aggregatedBlockRewards.value);
});

let blocksSubscription: any = null;
let lastBlockTimestamp: Dayjs;

function loadBlocks() {
  blockchainStore.fetchBlocks(null, null, 8).then(newBlocks => {
    blocks.value = newBlocks.reverse();
  });
  lastBlockTimestamp = blocks.value[0]?.timestamp;
  blocksSubscription = blockchainStore.subscribeToBlocks(newBlock => {
    const blockExists = blocks.value.find(block => block.hash === newBlock.hash);
    if (blockExists) return;

    blocks.value.push(newBlock);
    lastBlockTimestamp = newBlock.timestamp;
    if (blocks.value.length > 8) {
      blocks.value.shift();
    }
  });
}

function updateTimeSinceBlock() {
  if (lastBlockTimestamp) {
    const now = dayjs.utc();
    const totalSecondsSinceBlock = now.diff(lastBlockTimestamp, 'seconds');
    minutesSinceBlock.value = totalSecondsSinceBlock < 60 ? 0 : Math.floor(totalSecondsSinceBlock / 60);
    secondsSinceBlock.value = totalSecondsSinceBlock % 60;
  }

  setTimeout(() => updateTimeSinceBlock(), 1000);
}

function openConfigureMiningBotOverlay() {
  emitter.emit('openConfigureMiningBotOverlay');
}

Vue.onMounted(async () => {
  updateTimeSinceBlock();
  loadBlocks();

  Promise.all([
    blockchainStore.updateAggregateBidCosts(),
    blockchainStore.updateAggregateBlockRewards(),
    blockchainStore.updateMiningSeatCount(),
  ]).then(() => {
    isLoaded.value = true;
  });
});
</script>

<style lang="scss" scoped>
ul[Blocks] {
  position: relative;
  &:before {
    content: '';
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    width: 8%;
    height: 100%;
    background: linear-gradient(to right, rgba(249, 242, 250, 1), rgba(249, 242, 250, 0));
  }
  li[Block] {
    border: 4px solid #cacdd1;
    width: 16%;
    text-align: center;
    padding: 10px 5px;
    font-weight: 200;
  }
  li[Connection] {
    width: 0.8%;
    position: relative;
    &:before {
      content: '';
      display: block;
      width: calc(100% + 16px);
      box-shadow: 1px 1px 0 0 rgba(0, 0, 0, 0.5);
      height: 7px;
      background-color: #b9bcc0;
      position: absolute;
      top: 50%;
      right: -8px;
      transform: translateY(-50%);
    }
  }
}
</style>
