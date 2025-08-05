<template>
  <HoverCardRoot :openDelay="0" :closeDelay="0" class="relative pointer-events-auto" v-model:open="isOpen">
    <HoverCardTrigger>
      <div v-if="wallets.isLoaded" class="group cursor-pointer">
        <div
          v-if="status === 'underfunded'"
          class="flex flex-row items-center gap-x-2 bg-red-500 border border-red-600 text-white px-4 py-0.5 rounded-md"
        >
          <div class="w-4 h-4">
            <StatusSad />
          </div>
          Underfunded
        </div>

        <div
          v-else-if="status === 'overfunded'"
          class="flex flex-row items-center gap-x-2 bg-yellow-600/70 border border-yellow-600/60 text-white px-4 py-0.5 rounded-md"
        >
          <div class="w-4 h-4">
            <StatusNeutral />
          </div>
          Overfunded
        </div>

        <div
          v-else
          class="flex flex-row items-center gap-x-2 border group-hover:bg-lime-500/80 group-hover:text-white group-hover:border-lime-600 px-4 py-0.5 rounded-md"
          :class="[
            isOpen ? 'bg-lime-500/80 text-white border-lime-600' : 'bg-white text-lime-600/60 border-lime-600/60',
          ]"
        >
          <div class="w-4 h-4">
            <StatusHappy />
          </div>
          Fully Funded
        </div>
      </div>
      <div v-else class="text-gray-900 px-2">Loading...</div>
    </HoverCardTrigger>

    <HoverCardPortal>
      <HoverCardContent
        :align="'end'"
        :alignOffset="0"
        :sideOffset="-3"
        class="data-[side=bottom]:animate-slideUpAndFade data-[side=right]:animate-slideLeftAndFade data-[side=left]:animate-slideRightAndFade data-[side=top]:animate-slideDownAndFad data-[state=open]:transition-all"
      >
        <div
          class="flex flex-col shrink rounded bg-white text-md text-gray-900 shadow-lg ring-1 ring-gray-900/20 w-120 p-1"
        >
          <div v-if="miningAccountStatus === 'underfunded'" class="bg-red-100/70 py-4 px-4 rounded-md">
            <header class="flex flex-row items-center gap-x-2 text-lg font-bold text-red-600 whitespace-nowrap">
              <StatusSad class="w-5 h-5" />
              <span>Your Mining Account Is Lacking Funds</span>
            </header>
            <p class="py-1 mt-px opacity-80">
              Your accounts needs 1,000 ARGNs and 2 ARGNOTs in order to fully operate according to your bidding rules.
            </p>
            <div class="flex flex-row gap-x-2 mt-2">
              <button
                @click="openFundMiningAccountOverlay"
                class="px-4 py-1.5 rounded-md border border-red-600 text-red-700/70 hover:bg-red-600/10 cursor-pointer font-bold"
              >
                Transfer Tokens Into Account
              </button>
            </div>
          </div>
          <div v-else-if="miningAccountStatus === 'overfunded'" class="bg-yellow-100/70 py-4 px-4 rounded-md">
            <header class="flex flex-row items-center gap-x-2 text-lg font-bold text-yellow-600 whitespace-nowrap">
              <StatusNeutral class="w-5 h-5" />
              <span>Your Mining Account Has Excess Funds</span>
            </header>
            <p class="py-1 mt-px opacity-80">
              Your account has an extra 10 ARGNs sitting unused. This isn't causing harm, but it's also not generating
              yield on your asset.
            </p>
            <div class="flex flex-row gap-x-2 mt-2">
              <button
                class="px-4 py-1.5 rounded-md border border-red-600 text-red-700/70 hover:bg-red-600/10 cursor-pointer font-bold"
              >
                Add Capital to Bidding Budget
              </button>
            </div>
          </div>
          <div v-else class="py-4 px-4 rounded-md">
            <header class="flex flex-row items-center gap-x-2 text-lg font-bold text-lime-600 whitespace-nowrap">
              <StatusHappy class="w-5 h-5" />
              <span>Your Mining Account Is Looking Good</span>
            </header>
            <p class="py-1 mt-px opacity-80">
              Your mining account has enough funds to operate according to your bidding rules. No further action is
              required. However, you can always add more funds.
            </p>
            <div class="flex flex-row gap-x-2 mt-2">
              <button
                @click="openFundMiningAccountOverlay"
                class="px-4 py-1.5 rounded-md border border-lime-600 text-lime-700/70 hover:bg-lime-600/10 cursor-pointer font-bold"
              >
                Transfer More Tokens Into Mining
              </button>
            </div>
          </div>

          <div class="h-px bg-gray-200/80 my-1" />

          <div v-if="vaultingAccountStatus === 'underfunded'" class="bg-red-100/70 py-4 px-4 rounded-md">
            <header class="flex flex-row items-center gap-x-2 text-lg font-bold text-red-600 whitespace-nowrap">
              <StatusSad class="w-5 h-5" />
              <span>Your Vaulting Account Is Lacking Funds</span>
            </header>
            <p class="py-1 mt-px opacity-80">
              Your accounts needs 1,000 ARGNs and 2 ARGNOTs in order to fully operate your vault effeciently.
            </p>
            <div class="flex flex-row gap-x-2 mt-2">
              <button
                @click="openFundVaultingAccountOverlay"
                class="px-4 py-1.5 rounded-md border border-red-600 text-red-700/70 hover:bg-red-600/10 cursor-pointer font-bold"
              >
                Transfer Tokens Into Account
              </button>
            </div>
          </div>
          <div v-else-if="vaultingAccountStatus === 'overfunded'" class="bg-yellow-500/10 py-4 px-4 rounded-md">
            <header class="flex flex-row items-center gap-x-2 text-lg font-bold text-yellow-600 whitespace-nowrap">
              <StatusNeutral class="w-5 h-5" />
              <span>Your Vaulting Account Has Excess Funds</span>
            </header>
            <p class="py-1 mt-px opacity-80">
              Your account has an extra 10 ARGNs sitting unused. This isn't causing harm, but they're also not
              generating yield.
            </p>
            <div class="flex flex-row gap-x-2 mt-2">
              <button
                class="px-4 py-1.5 rounded-md border border-yellow-600 text-yellow-700/70 hover:bg-yellow-600/10 cursor-pointer font-bold"
              >
                Add to Vault's Working Capital
              </button>
            </div>
          </div>
          <div v-else class="py-4 px-4 rounded-md">
            <header class="flex flex-row items-center gap-x-2 text-lg font-bold text-lime-600 whitespace-nowrap">
              <StatusHappy class="w-5 h-5" />
              <span>Your Vaulting Account Is Looking Good</span>
            </header>
            <p class="py-1 mt-px opacity-80">
              Your vaulting account has enough funds to operate. No further action is required at this time. However,
              you can always improve your vault with more funds.
            </p>
            <div class="flex flex-row gap-x-2 mt-2">
              <button
                @click="openFundVaultingAccountOverlay"
                class="px-4 py-1.5 rounded-md border border-lime-600 text-lime-700/70 hover:bg-lime-600/10 cursor-pointer font-bold"
              >
                Transfer More Tokens Into Vault
              </button>
            </div>
          </div>
        </div>
        <HoverCardArrow :width="18" :height="10" class="fill-white stroke-gray-300 mt-[0px]" />
      </HoverCardContent>
    </HoverCardPortal>
  </HoverCardRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { HoverCardArrow, HoverCardContent, HoverCardPortal, HoverCardRoot, HoverCardTrigger } from 'reka-ui';
import { useWallets } from '../stores/wallets';
import StatusSad from '../assets/status-sad.svg';
import StatusNeutral from '../assets/status-neutral.svg';
import StatusHappy from '../assets/status-happy.svg';
import basicEmitter from '../emitters/basicEmitter';

type IStatus = 'underfunded' | 'overfunded' | 'funded';

const wallets = useWallets();

const isOpen = Vue.ref(false);

const miningAccountStatus = Vue.computed<IStatus>(() => {
  // if (wallets.miningWallet.microgonsBid < 1_000) {
  //   return 'underfunded';
  // }
  return 'funded';
});

const vaultingAccountStatus = Vue.computed<IStatus>(() => {
  // if (wallets.vaultingWallet.microgonsBid < 1_000) {
  //   return 'underfunded';
  // }
  return 'funded';
});

const status = Vue.computed<IStatus>(() => {
  if (miningAccountStatus.value === 'underfunded' || vaultingAccountStatus.value === 'underfunded') {
    return 'underfunded';
  }
  if (miningAccountStatus.value === 'overfunded' || vaultingAccountStatus.value === 'overfunded') {
    return 'overfunded';
  }
  return 'funded';
});

function openFundMiningAccountOverlay() {
  basicEmitter.emit('openWalletOverlay', { walletId: 'mining', screen: 'receive' });
}

function openFundVaultingAccountOverlay() {
  basicEmitter.emit('openWalletOverlay', { walletId: 'vaulting', screen: 'receive' });
}
</script>
