<!-- prettier-ignore -->
<template>
  <div class="flex flex-col h-full w-full relative">
    <div @click="goBack" class="absolute flex flex-row gap-x-2 z-10 top-3 pb-3 pr-10 left-5 items-center text-slate-400/50 hover:text-slate-600 cursor-pointer">
      <ArrowLeftIcon class="size-4 " />
      <div>
        Back to Start
      </div>
      <div class="absolute bottom-0 left-0 w-[200%] h-px bg-gradient-to-r from-slate-400/30 from-0% via-slate-400/30 via-50% to-transparent to-100%"></div>
    </div>    
    <div class="relative px-[15%] pt-2">
      <div>
        <h1 class="text-4xl font-bold text-left mt-24 mb-4 whitespace-nowrap text-argon-text-primary">
          Three Steps Are Required Before Vaulting
        </h1>

        <p class="mb-4 text-argon-text-primary leading-7">
          Creating a new Stabilization Vault is quite easy. This page walks you through the entire process. The biggest task is figuring out how much capital you want to commit, which you'll do in Vault Settings (the second item on this checklist).
        </p>

        <section
          @click="openHowVaultingWorksOverlay"
          class="flex flex-row cursor-pointer mt-8 border-t border-[#CCCEDA] py-9 hover:bg-argon-menu-hover"
        >
          <Checkbox :isChecked="config.hasReadVaultingInstructions" />
          <div class="px-4">
            <h2 class="text-2xl text-[#A600D4] font-bold">Learn How Vaulting Works</h2>
            <p v-if="!config.hasReadVaultingInstructions">
              Read an overview of what vaulting is, how it works, and the core concepts you'll need to understand.
            </p>
            <p v-else>
              You skimmed the basics of what vaulting is, how it works, and the core concepts you'll need to understand.
            </p>
          </div>
        </section>

        <section
          @click="openVaultOverlay"
          class="flex flex-row cursor-pointer border-t border-[#CCCEDA] py-9 hover:bg-argon-menu-hover"
        >
          <Checkbox :isChecked="config.hasSavedVaultingRules" />
          <div class="px-4">
            <h2 class="text-2xl text-[#A600D4] font-bold">Configure Your Vault Settings</h2>
            <p v-if="!config.hasSavedVaultingRules">
              Decide how much capital to commit, your distribution between securitization and liquidity, and other basic settings.
            </p>
            <p v-else>
              You setup your bidding rules and <span class="underline decoration-dashed underline-offset-4 decoration-slate-600/80">committed 
              {{ currency.symbol }}{{ microgonToArgonNm(config.vaultingRules?.baseCapitalCommitment || 0n).format('0,0.[00]') }}</span>
              <!-- with an <span class="underline decoration-dashed underline-offset-4 decoration-slate-600/80">average expected APY return of {{ numeral(averageAPY).formatIfElseCapped('>=100', '0,0', '0,0.00', 999_999) }}%</span>. -->
            </p>
          </div>
        </section>

        <section
          @click="openFundMiningAccountOverlay"
          class="flex flex-row cursor-pointer border-t border-b border-[#CCCEDA] py-9"
        >
          <Checkbox :isChecked="walletIsFullyFunded" />
          <div class="px-4">
            <h2 class="text-2xl text-[#A600D4] font-bold">
              {{ walletIsPartiallyFunded ? 'Finish' : '' }} Fund{{ walletIsPartiallyFunded ? 'ing' : '' }}
              Your Wallet
            </h2>
            <p>
              Your account needs a minimum of
              {{ microgonToArgonNm(config.vaultingRules?.baseCapitalCommitment || 0n).format('0,0.[00000000]') }} argon{{
                microgonToArgonNm(config.vaultingRules?.baseCapitalCommitment || 0n).format('0') === '1' ? '' : 's'
              }}
              <template v-if="config.vaultingRules?.requiredMicronots">
                and
                {{
                  micronotToArgonotNm(config.vaultingRules?.requiredMicronots || 0n).format('0,0.[00000000]')
                }}
                argonot{{
                  micronotToArgonotNm(config.vaultingRules?.requiredMicronots || 0n).format('0') === '1' ? '' : 's'
                }}
              </template>
              to operate your vault. A secure wallet is already attached to your account. All you need to do is move
              some tokens.
            </p>
          </div>
        </section>
      </div>
      <button
        @click="createVault"
        :class="[
          walletIsFullyFunded
            ? 'text-white'
            : 'text-white/70 pointer-events-none opacity-30'
        ]"
        class="bg-argon-button border border-argon-button-hover mt-10 text-2xl font-bold px-4 py-4 rounded-md w-full cursor-pointer hover:bg-argon-button-hover hover:inner-button-shadow"
      >
        Launch Stabilization Vault
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import basicEmitter from '../../emitters/basicEmitter';
import { useConfig } from '../../stores/config';
import { useWallets } from '../../stores/wallets';
import { useCurrency } from '../../stores/currency';
import Checkbox from '../../components/Checkbox.vue';
import { createNumeralHelpers } from '../../lib/numeral';
import { ArrowLeftIcon } from '@heroicons/vue/24/outline';

dayjs.extend(utc);

const config = useConfig();
const wallets = useWallets();
const currency = useCurrency();

const { microgonToArgonNm, micronotToArgonotNm } = createNumeralHelpers(currency);

const walletIsPartiallyFunded = Vue.computed(() => {
  return (wallets.vaultingWallet.availableMicrogons || wallets.vaultingWallet.availableMicronots) > 0;
});

const walletIsFullyFunded = Vue.computed(() => {
  console.log('Checking if wallet is fully funded', walletIsPartiallyFunded.value);
  if (!walletIsPartiallyFunded.value) {
    return false;
  }

  if (wallets.vaultingWallet.availableMicrogons < (config.vaultingRules?.baseCapitalCommitment || 0n)) {
    return false;
  }

  if (wallets.vaultingWallet.availableMicronots < (config.vaultingRules?.requiredMicronots || 0n)) {
    return false;
  }

  return true;
});

function openVaultOverlay() {
  basicEmitter.emit('openVaultOverlay');
}

function openFundMiningAccountOverlay() {
  basicEmitter.emit('openWalletOverlay', { walletId: 'vaulting', screen: 'receive' });
}

async function createVault() {
  config.isVaultReadyToCreate = true;
  config.save();
}

function openHowVaultingWorksOverlay() {
  basicEmitter.emit('openHowVaultingWorksOverlay');
}

function goBack() {
  config.isPreparingVaultSetup = false;
}
</script>

<style scoped>
@reference "../../main.css";

section:hover {
  background: linear-gradient(to right, transparent 0%, #f7edf8 10%, #f7edf8 90%, transparent 100%);
}

section p {
  @apply mt-1 ml-0.5 opacity-60;
}
</style>
