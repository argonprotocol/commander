<template>
  <div class="flex flex-col h-full w-full p-3">
    <div class="grow relative bg-[#FCF9FD] rounded border border-[#CCCEDA] shadow">
      <div class="relative px-[15%]">
        <div :class="[isLaunchingMiningBot ? 'opacity-30 pointer-events-none' : '']">
          <h1 class="text-5xl font-bold text-left mt-20 mb-4 whitespace-nowrap">
            You're Almost Ready to Start Mining!
          </h1>

          <p class="mb-4">
            The only thing you still need is a Mining Seat! The only way to get a Mining Seat is win one at auction.
            Auctions are held every 24 hours, and they're open to everyone.
          </p>
          <p>
            Two things are required for auctions. First, you need to set up a few rules around how you want to bid.
            Second, you need an account that contains Argons and Argonots — these are used to assemble your bid. The
            following steps guide you through the process.
          </p>

          <section
            @click="openBiddingRulesOverlay"
            class="flex flex-row cursor-pointer mt-8 border-t border-[#CCCEDA] py-6 hover:bg-argon-menu-hover"
          >
            <Checkbox :isChecked="hasBiddingRules" />
            <div>
              <h2 class="text-2xl text-[#A600D4] font-bold">Configure Bidding Rules</h2>
              <p>
                You need to set a few basic rules like your starting bid amount, the maximum price you're willing to
                invest, and other basic settings.
              </p>
            </div>
          </section>

          <section
            @click="openFundMiningAccountOverlay"
            class="flex flex-row cursor-pointer border-t border-b border-[#CCCEDA] py-6"
          >
            <Checkbox :isChecked="walletIsFullyFunded" :isPartiallyChecked="walletIsMinimallyFunded" />
            <div>
              <h2 class="text-2xl text-[#A600D4] font-bold">
                {{ walletIsPartiallyFunded ? 'Finish' : '' }} Fund{{ walletIsPartiallyFunded ? 'ing' : '' }}
                Your Wallet
              </h2>
              <p v-if="config.biddingRules">
                Your acccounts needs a minimum of {{ config.biddingRules.requiredArgons }} argon{{
                  config.biddingRules.requiredArgons === 1 ? '' : 's'
                }}
                and {{ config.biddingRules.requiredArgonots }} argonot{{
                  config.biddingRules.requiredArgonots === 1 ? '' : 's'
                }}
                to submit auction bids. We already created a secure wallet and attached it to your mining server. All
                you need is move some tokens in.
              </p>
              <p v-else>
                Your acccounts needs enough argons and argonots to submit auction bids. We already created a secure
                wallet and attached it to your mining server. All you need is move some tokens in.
              </p>
            </div>
          </section>
        </div>

        <button
          @click="launchMiningBot"
          :class="[
            walletIsMinimallyFunded && hasBiddingRules ? 'text-white' : 'text-white/70 pointer-events-none opacity-30',
            isLaunchingMiningBot ? 'opacity-30 pointer-events-none' : '',
          ]"
          class="bg-argon-button border border-argon-button-hover mt-8 text-2xl font-bold px-4 py-4 rounded-md w-full cursor-pointer hover:bg-argon-button-hover hover:inner-button-shadow"
        >
          {{ isLaunchingMiningBot ? 'Launching Mining Bot...' : 'Launch Mining Bot' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import emitter from '../../emitters/basic';
import { useConfig } from '../../stores/config';
import { useCurrencyStore } from '../../stores/currency';
import Checkbox from '../../components/Checkbox.vue';
import { useInstaller } from '../../stores/installer';

dayjs.extend(utc);

const config = useConfig();
const installer = useInstaller();
const currencyStore = useCurrencyStore();

const isLaunchingMiningBot = Vue.ref(false);

const hasBiddingRules = Vue.computed(() => {
  return !!config.biddingRules;
});

const walletIsPartiallyFunded = Vue.computed(() => {
  if (!config.biddingRules) {
    return false;
  }

  return (currencyStore.mngWallet.argons || currencyStore.mngWallet.argonots) > 0;
});

const walletIsMinimallyFunded = Vue.computed(() => {
  if (!walletIsPartiallyFunded.value || !config.biddingRules) {
    return false;
  }

  if (currencyStore.mngWallet.argons < config.biddingRules.requiredArgons) {
    return false;
  }

  if (currencyStore.mngWallet.argonots < config.biddingRules.requiredArgonots) {
    return false;
  }

  return true;
});

const walletIsFullyFunded = Vue.computed(() => {
  if (!walletIsMinimallyFunded.value || !config.biddingRules) {
    return false;
  }

  if (currencyStore.mngWallet.argons < config.biddingRules.desiredArgons) {
    return false;
  }

  if (currencyStore.mngWallet.argonots < config.biddingRules.desiredArgonots) {
    return false;
  }

  return true;
});

function openBiddingRulesOverlay() {
  emitter.emit('openBiddingRulesOverlay');
}

function openFundMiningAccountOverlay() {
  emitter.emit('openWalletOverlay', { walletId: 'mng', screen: 'receive' });
}

async function launchMiningBot() {
  if (isLaunchingMiningBot.value) {
    return;
  }
  isLaunchingMiningBot.value = true;

  await installer.upgradeBiddingBotFiles();
  isLaunchingMiningBot.value = false;
}
</script>

<style scoped>
@reference "../../main.css";

section:hover {
  background: linear-gradient(to right, transparent 0%, #f7edf8 10%, #f7edf8 90%, transparent 100%);
}

@keyframes pulseEffect {
  0%,
  100% {
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
