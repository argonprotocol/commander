<template>
  <div class="flex flex-col h-full">
    <div style="text-shadow: 1px 1px 0 white">
      <div class="text-5xl leading-tight font-bold text-center mt-20 text-[#4B2B4E]">
        Earn Argons and Argonots
        <div>By Running Your Own Mining Node</div>
      </div>
      <p class="text-md text-justify w-[650px] !mx-auto mt-10 text-[#4B2B4E]">
        Argon uses a special auction process to determine who can mine. The winners of each auction hold the
        right to mine for ten days, then it goes back up for bidding. Argon's mining software is runnable on cheap virtual cloud machines, which makes getting involved easy and cost-effective. Click the button below to get started.</p>
    </div>
    <button @click="openConnectCloudOverlay" class="bg-argon-500 hover:bg-argon-600 border border-argon-700 inner-button-shadow text-xl font-bold text-white px-7 py-2 rounded-md mx-auto block mt-10 cursor-pointer">
      Connect Cloud Machine
    </button>
    <div class="flex-grow flex flex-row items-end w-full">
      <div class="flex flex-col w-full px-5 pb-5">
        <ul class="flex flex-row text-center text-sm text-[#4B2B4E] w-full py-7 border-t border-b border-slate-300 mb-5">
          <li class="w-1/4">
            <div class="text-4xl font-bold">{{ blockchainStore.miningSeatCount ? addCommas(blockchainStore.miningSeatCount) : '---' }}</div>
            <div>Mining Seats</div>
          </li>
          <li style="width: 1px" class="bg-slate-300"></li>
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="blockchainStore.aggregateBidCosts">
                <span :class="[currencySymbol === '₳' ? 'font-medium' : 'font-bold']">{{currencySymbol}}</span>{{ addCommas(argonTo(blockchainStore.aggregateBidCosts), blockchainStore.aggregateBidCosts > 1_000 ? 0 : 2) }}
              </template>
              <template v-else>
                ---
              </template>
            </div>
            <div>Aggregate Bid Costs</div>
          </li>
          <li style="width: 1px" class="bg-slate-300"></li>
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="blockchainStore.minimumBlockRewards">
                <span :class="[currencySymbol === '₳' ? 'font-medium' : 'font-bold']">{{currencySymbol}}</span>{{ addCommas(argonTo(blockchainStore.minimumBlockRewards), blockchainStore.minimumBlockRewards > 1_000 ? 0 : 2) }}
              </template>
              <template v-else>
                ---
              </template>
            </div>
            <div>Mimimum Aggregate Rewards</div>
          </li>
          <li style="width: 1px" class="bg-slate-300"></li>
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="blockchainStore.currentAPY">
                {{ addCommas(blockchainStore.currentAPY, blockchainStore.currentAPY > 100 ? 0 : 2) }}%{{ blockchainStore.currentAPY >= 9_999? '+' : ' ' }}
              </template>
              <template v-else>
                ---
              </template>
            </div>
            <div>Annual Percentage Yield</div>
          </li>
        </ul>
        <ul Blocks class="w-full flex flex-row justify-end" :style="{ opacity: blockchainStore.recentBlocksAreLoaded ? 1 : 0.1 }">
          <template v-for="(block, index) in blockchainStore.recentBlocks" :key="`${block.hash}-${index}`">
            <li Block class="leading-6">
              <div class="border-b border-slate-300 pb-1 mb-2">#<span class="font-bold opacity-50">{{ block.number }}</span></div>
              <div>{{ block.extrinsics }} txns</div>
              <div>{{ block.argons }} argons</div>
              <div>{{ block.argonots }} argonots</div>
            </li>
            <li Connection></li>
          </template>
          <li Block class="flex flex-col text-center justify-center items-center">
            <img src="../../assets/mining.gif" class="w-8 inline-block relative -left-1">
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
          </li>
        </ul>
      </div>
    </div>
  </div>
  
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import emitter from '../../emitters/basic';
import { useBlockchainStore } from '../../stores/blockchain';
import { useAccountStore } from '../../stores/account';
import { addCommas } from '../../lib/Utils';
import { storeToRefs } from 'pinia';

dayjs.extend(utc);

const blockchainStore = useBlockchainStore();
const accountStore = useAccountStore();

const { argonTo } = accountStore;
const { currencySymbol } = storeToRefs(accountStore);

const minutesSinceBlock = Vue.ref(0);
const secondsSinceBlock = Vue.ref(0);

function updateTimeSinceBlock() {
  if (blockchainStore.lastBlockTimestamp) {
    const now = dayjs.utc();
    const lastBlockTime = dayjs.utc(blockchainStore.lastBlockTimestamp);
    const totalSecondsSinceBlock = now.diff(lastBlockTime, 'seconds');
    minutesSinceBlock.value = totalSecondsSinceBlock < 60 ? 0 : Math.floor(totalSecondsSinceBlock / 60);
    secondsSinceBlock.value = totalSecondsSinceBlock % 60;
  }

  setTimeout(() => updateTimeSinceBlock(), 1000);
}

function openConnectCloudOverlay() {
  emitter.emit('openConnectCloudOverlay');
}

Vue.onMounted(async () => {
  updateTimeSinceBlock();
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
    border: 4px solid #CACDD1;
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
      background-color: #B9BCC0;
      position: absolute;
      top: 50%;
      right: -8px;
      transform: translateY(-50%);
    }
  }
}
</style>