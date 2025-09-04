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
          class="HowVaultingWorksOverlay absolute top-20 left-24 right-24 bottom-12 flex flex-col rounded-md border border-black/40 shadow-xl bg-argon-menu-bg text-left z-20 transition-all focus:outline-none"
        >
          <div class="flex flex-col h-full w-full">
            <h2
              class="relative text-3xl font-bold text-left border-b border-slate-300 pt-5 pb-4 pl-3 mx-4 text-[#672D73]"
              style="box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1)"
            >
              <DialogTitle as="div" class="relative z-10">How Vaulting Works</DialogTitle>
              <div @click="cancelOverlay" class="absolute top-[22px] right-[0px] z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/70 hover:bg-[#D6D9DF]">
                <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
              </div>
            </h2>

            <div v-if="isLoaded" class="flex flex-col grow relative w-full overflow-y-auto px-8 py-5">
              <p>
                In many ways vaulting is the flip side of the mining process. Miners bring new stablecoins into existence, and
                Vaulters provide services to stabilize those stablecoins. Miners buy mining seats at auction, and vaulters
                collect all the revenue generated from those auctions.
              </p>

              <p>
                Unlike the mining side, no cloud machine is required to operate a vault. Everything runs directly from this app on your local machine.
              </p>

              <p>Below is a brief overview of how it all works.</p>

              <ul>
                <li>
                  <header>The Purpose of Vaults</header>
                  - Securitize the Bitcoin that is used to stabilize the Argon stablecoin.
                  - Provide liquidity to the Argon network
                </li>

                <li>
                  <header>Vault Revenue Streams</header>
                - Earn liquid locking fees from Bitcoins. You choose a base fee and a percentage fee.
                - Earn revenue from the network treasury.
                <table> <!-- Show daily revenue from locking fees and treasury --></table>
                </li>

                <li>
                  <header>Vault Responsibilities</header>
                  - Custodian your half of the BTC multisig addresses for securing the network's bitcoin.
                  - Provide unlocking services for Bitcoin locks within 10 days.
                </li>

                <li>
                  <header>Understanding the Network Treasury</header>
                  - The treasury is funded by auction revenue from mining seat bidding.
                  - Every frame/day's bids go into a new treasury pool.
                  - The capital from each day's treasury pool is used in three ways:
                    - Burn 20% of the capital to prevent inflation.
                    - Distribute 80% of the capital to the vaults, paid pro-rata based on a combination of 
                      how much BTC is locked into the vault and matching capital supplied by the vaults.
                    - Use the 80% of capital that is earmarked for the vaults as short-term loans for the network to provide instant liquidity for Bitcoin locks.
                    <table> <!-- Show daily treasury pools for the last ten frames --></table>
                </li>

                <li>
                  <header>Understanding Liquid Locking for Bitcoin</header>
                  - Liquid Locking is a way to lock Bitcoin into a vault, and receive Argon tokens in return. Capital in the treasury is used
                    to provide instant liquidity for Bitcoin locks.
                  - This is a way to unlock the liquidity of your Bitcoin, while still maintaining custody.
                  - Your Bitcoin Lock creates an option against the Argon network that can be called by burning Argons to release your Bitcoin.
                  - If the Argon price is below target, this can result in arbitrage opportunities.

                  <table> <!-- Show BTC locked per day, how much was paid out in argons, how much was borrowed from treasury --></table>
                </li>

                <li>
                  <header>Kickstarting Your Vault with BTC</header>
                  - You can kickstart your vault by directy depositing an initial bitcoin transaction into it. This vault transaction avoids any locking fees.
                  - Your vault will then be considered active and you will be able to earn revenue from it.
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

basicEmitter.on('openHowVaultingWorksOverlay', async () => {
  if (isOpen.value) return;
  isOpen.value = true;
  isLoaded.value = true;
  config.hasReadVaultingInstructions = true;
});
</script>

<style>
@reference "../../main.css";

.HowVaultingWorksOverlay {
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

  header {
    @apply mt-2 font-bold;
  }

  ul > li,
  p {
    @apply mb-4;
  }

  ol > li {
    @apply mt-2;
  }

  ol {
    @apply ml-6;
  }

  table {
    @apply text-md mt-3 mb-5 ml-0.5 w-full font-mono;
    th {
      @apply pb-1 text-right font-bold;
    }
    td {
      @apply border-t border-slate-300 py-1 text-right;
    }
    tr:last-child td {
      @apply border-b border-slate-300;
    }
    th:first-child,
    td:first-child {
      @apply text-left;
    }
  }
}
</style>
