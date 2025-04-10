<template>
  <div class="flex flex-col h-full w-full p-3">

    <div class="grow relative bg-[#FCF9FD] rounded border border-[#CCCEDA] shadow">

      <div class="relative px-[15%]">
        <h1 class="text-5xl font-bold text-left mt-20 mb-4 whitespace-nowrap">You're Almost Ready to Start Mining!</h1>

        <p class="mb-4">
          Your server is setup and ready to go. All you need is a Mining Seat. The only way to get a Mining Seat is win one at auction. Auctions are held every 24 hours, and they’re open to everyone.
        </p>
        <p>
          Two things are required for auctions. First, you need to set up a few rules around how you want to bid. Second, you need an account that contains Argons and Argonots — these are used to assemble your bid. The
          following steps guide you through the process.
        </p>

        <section @click="openBiddingRulesOverlay" class="flex flex-row cursor-pointer mt-8 border-t border-[#CCCEDA] py-6 hover:bg-argon-menu-hover">
          <div v-if="accountStore.biddingConfig" class="flex items-center justify-center min-w-8 min-h-8 w-8 h-8 border-4 mr-4 border-argon-button bg-argon-button">
            <svg class="pointer-events-none size-10 self-center justify-self-center stroke-white" viewBox="0 0 14 14" fill="none">
              <path class="opacity-100" d="M3 8L6 11L11 3.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <div v-else class="min-w-8 min-h-8 w-8 h-8 border-4 border-slate-400 mr-4" />
          <div>
            <h2 class="text-2xl text-[#A600D4] font-bold">Configure Bidding Rules</h2>
            <p>You need to set a few basic rules like your starting bid amount, the maximum price you’re willing to invest, and other basic settings.</p>
          </div>
        </section>

        <section @click="openFundMiningAccountOverlay" class="flex flex-row cursor-pointer border-t border-b border-[#CCCEDA] py-6 hover:bg-argon-menu-hover">
          <div class="min-w-8 min-h-8 w-8 h-8 border-4 border-slate-400 mr-4" />
          <div>
            <h2 class="text-2xl text-[#A600D4] font-bold">{{walletIsPartiallyFunded ? 'Finish' : ''}} Fund{{walletIsPartiallyFunded ? 'ing' : ''}} Your Wallet</h2>
            <p>Your acccounts needs enough argons and argonots to submit auction bids. We already created a secure wallet and attached it to your mining server. All you need is move some tokens in.</p>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import emitter from '../../emitters/basic';
import { useAccountStore } from '../../stores/account';

dayjs.extend(utc);

const accountStore = useAccountStore();

const walletIsPartiallyFunded = Vue.computed(() => {
  return accountStore.argonBalance || accountStore.argonotBalance;
});

function openBiddingRulesOverlay() {
  emitter.emit('openBiddingRulesOverlay');
}

function openFundMiningAccountOverlay() {
  emitter.emit('openWalletOverlay', { walletId: 'mng', screen: 'receive' });
}
</script>

<style scoped>
@reference "../../main.css";

[CountdownClock] {
  color: #3E444E;
  div > div {
    @apply text-xl md:text-8xl font-normal opacity-50 md:-mt-2;
  }
  ul {
    @apply px-14;
  }
  ul li:first-child {
    @apply text-3xl md:text-8xl font-bold;
  }
  ul li:last-child {
    @apply text-sm md:text-xl font-light;
  }
}

@keyframes pulseEffect {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.95);
  }
}

[isClosing] {
  animation: pulseEffect 1.5s ease-in-out infinite;
}
</style>