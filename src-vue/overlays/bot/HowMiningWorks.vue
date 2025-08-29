<!-- prettier-ignore -->
<template>
  <DialogRoot class="absolute inset-0 z-10" :open="isOpen">
    <DialogPortal>
      <DialogOverlay asChild>
        <BgOverlay @close="cancelOverlay" />
      </DialogOverlay>

      <DialogContent @escapeKeyDown="cancelOverlay" :aria-describedby="undefined">
        <div
          ref="dialogPanel"
          class="HowMiningWorksOverlay absolute top-20 left-24 right-24 bottom-12 flex flex-col rounded-md border border-black/40 shadow-xl bg-argon-menu-bg text-left z-20 transition-all focus:outline-none"
        >
          <div class="flex flex-col h-full w-full">
            <h2
              class="relative text-3xl font-bold text-left border-b border-slate-300 pt-5 pb-4 pl-3 mx-4 text-[#672D73]"
              style="box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1)"
            >
              <DialogTitle as="div" class="relative z-10">How Mining Works</DialogTitle>
              <div @click="cancelOverlay" class="absolute top-[22px] right-[0px] z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/70 hover:bg-[#D6D9DF]">
                <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
              </div>
            </h2>

            <div v-if="isLoaded" class="flex flex-col grow relative w-full overflow-y-auto px-8 py-5">
              <p>
                The most basic thing to understand about Argon is that there is no central company, authority, or server helping to run 
                this app. It simply exists as code running on your computer. In fact, the entire Argon blockchain is fully 
                decentralized and anonymous. It's operated by the community, by people just like yourself. That's why there is no
                signup screen or login screen for this app. Instead, a special auction bid system is used to
                create a rotating governance structure that is shared by all and open to everyone.
              </p>

              <ul>
                <li><strong>Mining Seats</strong>. The
                  network starts with a minimum of 100 seats, which are distributed at auction every 10 days (i.e., 10 seats per day).
                  As the network grows, the number of seats will increase up to a maximum of 10,000 seats. The current number of seats:
                  [show table] 
                </li>
                <li>
                  <strong>Term Limits</strong>. Once you win a mining seat you have the right to mine for 10 days. 
                </li>
                <li><strong>Bidding In Auctions</strong>. To mine in Argon you must win a mining seat, which are sold in auctions held every 24 hours. </li>
                <li><strong>Selection of Winners</strong>. Winners are selected based on the highest bid. Winning amounts for the last ten days are as follows: 
                  [show table] 
                </li>
                <li><strong>Cost to Win</strong>. Winning these mining seats require two tokens: 
                  <ol>
                    <li><strong>Argonots</strong>. This is a preset quanitity of Argonots for your bid to be valid. The amount changes based on the mining seat demand of the previous ten days. Current demand is: [show table] </li>
                    <li><strong>Argons</strong>: Each participant decide how much they want to bid. Winners are selected based on the highest bid. Winning amounts for the last ten days are as follows: [show table] </li>
                  </ol>
                </li>
                <li>
                <strong>Acquiring Tokens</strong>. You can acquire argons and argonots by mining blocks or buying them on decentralized exchanges such
                as Uniswap. 
                </li>
                <li>
                  <strong>Block Rewards</strong>. When you mine a block you receive four rewards: 
                  <ol>
                    <li>Base argon rewards, which is variable based on argon demand. This is set at the start of each auction and is guaranteed for all the seats in the auction. </li>
                    <li>Base argonot rewards, which will grow until the 365th frame (on or around January 15th, 2026). </li>
                    <li>Transaction fees for all transactions in the block. </li>
                    <li>Minting of new argons based on increased demand for argon during the seat's 10 day mining period. </li>
                  </ol>
                </li>
                <li>
                  <strong>Block Distribution</strong>. The authority to mine a block is based on a mathematical formula that effectively
                  round-robins between all active mining seats. A new block is mined every minute, which means 1,440 blocks are mined
                  per frame/day. If there are 100 active seats then each seat will mine an average of 14.4 blocks per day. 
                </li>
                <li>
                  <strong>Seat Continuation</strong>. Once your seat's 10 day mining period is over, you will need to re-bid at auction to continue mining. 
                </li>
                <li>
                  <strong>Your Automated Mining Bot</strong>. We created a mining bot to automate your bidding processs and manage mining operations. We
                  give you a simple configuration interface to help you set up your mining bot. You decide the configuration such as
                  startin bid, maximum bid, etc. Your mining bot will continue to run in the background and earn you rewards unless you
                  choose to stop it. 
                </li>
                
                <li>
                  <strong>Terminology</strong>: 
                  <ol>
                    <li>Frame. A frame is a 24 hour period. </li>
                    <li>Seat. A seat is a right to mine a block for 10 days. </li>
                    <li>Auction. An auction is a sale of seats for 10 days. </li>
                    <li>Block. A block is a unit of work that is rewarded with argon. </li>
                    <li>Mining Seat. A mining seat is a right to mine a block for 10 days. </li>
                    <li>Mining Auction. A mining auction is a sale of mining seats for 10 days. </li>
                  </ol>
                </li>
              </ul>
            </div>
            <div v-else>Loading...</div>

            <div class="flex flex-row justify-end border-t border-slate-300 mx-4 py-4 space-x-4 rounded-b-lg">
              <div class="flex flex-row space-x-4 justify-center items-center">
                <button @click="cancelOverlay" class="border border-argon-button/50 hover:border-argon-button text-xl font-bold text-gray-500 px-7 py-1 rounded-md cursor-pointer">
                  <span>Close Window</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, DialogDescription } from 'reka-ui';
import basicEmitter from '../../emitters/basicEmitter';
import { useConfig } from '../../stores/config';
import BgOverlay from '../../components/BgOverlay.vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';

const config = useConfig();

const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);

function cancelOverlay() {
  isOpen.value = false;
}

basicEmitter.on('openHowMiningWorksOverlay', async () => {
  if (isOpen.value) return;
  isOpen.value = true;
  isLoaded.value = true;
  config.hasReadMiningInstructions = true;
});
</script>

<style>
@reference "../../main.css";

.HowMiningWorksOverlay {
  h2 {
    position: relative;
    &:before {
      @apply from-argon-menu-bg bg-gradient-to-r to-transparent;
      content: '';
      display: block;
      width: 30px;
      position: absolute;
      z-index: 1;
      left: -5px;
      top: 0;
      bottom: -5px;
    }
    &:after {
      @apply from-argon-menu-bg bg-gradient-to-l to-transparent;
      content: '';
      display: block;
      width: 30px;
      position: absolute;
      z-index: 1;
      right: -5px;
      top: 0;
      bottom: -5px;
    }
  }

  ul > li,
  p {
    @apply mb-4;
  }

  ol > li {
    @apply mt-2;
  }

  ol {
    @apply ml-4;
  }
}
</style>
