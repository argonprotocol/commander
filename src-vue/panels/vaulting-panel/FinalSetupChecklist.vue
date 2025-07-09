<!-- prettier-ignore -->
<template>
  <div class="flex flex-col h-full w-full p-3">
    <div class="grow relative bg-[#FCF9FD] rounded border border-[#CCCEDA] shadow">
      <div class="relative px-[15%]">
        <div :class="[isLaunchingVault ? 'opacity-30 pointer-events-none' : '']">
          <h1 class="text-[40px] font-bold text-left mt-20 mb-4 whitespace-nowrap">
            You're Almost Ready to Start Vaulting!
          </h1>

          <p class="mb-4">
            Your vault is almost ready to start earning income. All that remains is funding the capital needed for
            operations. Click below to complete.
          </p>

          <section
            @click="openConfigureStabilizationVaultOverlay"
            class="flex flex-row cursor-pointer mt-8 border-t border-[#CCCEDA] py-6 hover:bg-argon-menu-hover"
          >
            <Checkbox :isChecked="true" />
            <div class="px-4">
              <h2 class="text-2xl text-[#A600D4] font-bold">Configure Vault Settings</h2>
              <p>
                You need to set a few basic rules like how much capital you want to commit, how you want to distribute it
                between securitization and liquidity, and other basic settings.
              </p>
            </div>
          </section>

          <section
            @click="openFundMiningAccountOverlay"
            class="flex flex-row cursor-pointer border-t border-b border-[#CCCEDA] py-6"
          >
            <Checkbox :isChecked="walletIsFullyFunded" />
            <div class="px-4">
              <h2 class="text-2xl text-[#A600D4] font-bold">
                {{ walletIsPartiallyFunded ? 'Finish' : '' }} Fund{{ walletIsPartiallyFunded ? 'ing' : '' }}
                Your Wallet
              </h2>
              <p>
                Your account needs a minimum of
                {{ microgonToArgonNm(config.vaultingRules?.requiredMicrogons || 0n).format('0,0.[00000000]') }} argon{{
                  microgonToArgonNm(config.vaultingRules?.requiredMicrogons || 0n).format('0') === '1' ? '' : 's'
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
            walletIsFullyFunded && config.serverDetails.ipAddress
              ? 'text-white'
              : 'text-white/70 pointer-events-none opacity-30',
            isLaunchingVault ? 'opacity-30 pointer-events-none' : '',
          ]"
          class="bg-argon-button border border-argon-button-hover mt-8 text-2xl font-bold px-4 py-4 rounded-md w-full cursor-pointer hover:bg-argon-button-hover hover:inner-button-shadow"
        >
          {{ isLaunchingVault ? 'Launching Stabilization Vault...' : 'Launch Stabilization Vault' }}
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
import { useWallets } from '../../stores/wallets';
import { useCurrency } from '../../stores/currency';
import Checkbox from '../../components/Checkbox.vue';
import { useInstaller } from '../../stores/installer';
import { createNumeralHelpers } from '../../lib/numeral';

dayjs.extend(utc);

const config = useConfig();
const installer = useInstaller();
const wallets = useWallets();
const currency = useCurrency();

const { microgonToArgonNm, micronotToArgonotNm } = createNumeralHelpers(currency);

const isLaunchingVault = Vue.ref(false);

const walletIsPartiallyFunded = Vue.computed(() => {
  return (wallets.mngWallet.availableMicrogons || wallets.mngWallet.availableMicronots) > 0;
});

const walletIsFullyFunded = Vue.computed(() => {
  if (!walletIsPartiallyFunded.value) {
    return false;
  }

  if (wallets.mngWallet.availableMicrogons < (config.vaultingRules?.requiredMicrogons || 0n)) {
    return false;
  }

  if (wallets.mngWallet.availableMicronots < (config.vaultingRules?.requiredMicronots || 0n)) {
    return false;
  }

  return true;
});

function openConfigureStabilizationVaultOverlay() {
  emitter.emit('openConfigureStabilizationVaultOverlay');
}

function openFundMiningAccountOverlay() {
  emitter.emit('openWalletOverlay', { walletId: 'vlt', screen: 'receive' });
}

async function createVault() {
  if (isLaunchingVault.value) {
    return;
  }
  isLaunchingVault.value = true;

  isLaunchingVault.value = false;
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
