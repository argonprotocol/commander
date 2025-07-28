<!-- prettier-ignore -->
<template>
  <div class="flex flex-col h-full w-full p-3">
    <div class="grow relative bg-[#FCF9FD] rounded border border-[#CCCEDA] shadow">
      <div class="relative px-[15%]">
        <div :class="[isLaunchingMiningBot ? 'opacity-30 pointer-events-none' : '']">
          <h1 class="text-[40px] font-bold text-left mt-20 mb-4 whitespace-nowrap">
            You're Almost Ready to Start Mining!
          </h1>

          <p class="mb-4">
            Your personal bidding bot is ready and waiting. You only need to complete a few more steps, such as funding your account and connecting a cloud machine.
          </p>

          <section
            @click="openBotOverlay"
            class="flex flex-row cursor-pointer mt-8 border-t border-[#CCCEDA] py-6 hover:bg-argon-menu-hover"
          >
            <Checkbox :isChecked="true" />
            <div class="px-4">
              <h2 class="text-2xl text-[#A600D4] font-bold">Configure Mining Bot</h2>
              <p>
                You've already set up your starting bid threshhold, the maximum price you're willing to
                invest, and other basic settings that are required.
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
              <p v-if="walletIsFullyFunded">
                Your account has been fully funded with enough argons and argonots to begin bidding. You can now connect a cloud machine and launch your mining bot.
              </p>
              <p v-else-if="walletIsPartiallyFunded">
                Your account already has
                <template v-if="wallets.miningWallet.availableMicrogons">
                  {{ microgonToArgonNm(wallets.miningWallet.availableMicrogons || 0n).format('0,0.[00000000]') }} argon{{
                    microgonToArgonNm(wallets.miningWallet.availableMicrogons || 0n).format('0.00000000') === '1.00000000' ? '' : 's'
                  }}
                </template>
                <template v-if="wallets.miningWallet.availableMicrogons && wallets.miningWallet.availableMicronots">
                  and
                </template>
                <template v-if="wallets.miningWallet.availableMicronots">
                  {{ micronotToArgonotNm(wallets.miningWallet.availableMicronots || 0n).format('0,0.[00000000]') }} argonot{{
                    micronotToArgonotNm(wallets.miningWallet.availableMicronots || 0n).format('0.00000000') === '1.00000000' ? '' : 's'
                  }}
                </template>.
                
                However you <strong class="opacity-80">still need</strong> another
                
                <template v-if="additionalMicrogonsNeeded">
                  {{ microgonToArgonNm(additionalMicrogonsNeeded).format('0,0.[00000000]') }} argon{{
                    microgonToArgonNm(additionalMicrogonsNeeded).format('0.00000000') === '1.00000000' ? '' : 's'
                  }}
                </template>
                <template v-if="additionalMicrogonsNeeded && additionalMicronotsNeeded">
                  and
                </template>
                <template v-if="additionalMicronotsNeeded">
                  {{ micronotToArgonotNm(additionalMicronotsNeeded).format('0,0.[00000000]') }} argonot{{
                    micronotToArgonotNm(additionalMicronotsNeeded).format('0.00000000') === '1.00000000' ? '' : 's'
                  }}
                </template>.
                Complete this step by moving the missing tokens to your account.
              </p>
              <p v-else>
                Your acccount needs a minimum of
                {{ microgonToArgonNm(config.biddingRules?.requiredMicrogons || 0n).format('0,0.[00000000]') }} argon{{
                  microgonToArgonNm(config.biddingRules?.requiredMicrogons || 0n).format('0.00000000') === '1.00000000' ? '' : 's'
                }}
                and
                {{
                  micronotToArgonotNm(config.biddingRules?.requiredMicronots || 0n).format('0,0.[00000000]')
                }}
                argonot{{
                  micronotToArgonotNm(config.biddingRules?.requiredMicronots || 0n).format('0.00000000') === '1.00000000' ? '' : 's'
                }}
                to submit auction bids. A secure wallet is already attached to your account. All you need to do is move
                some tokens.
              </p>
              
            </div>
          </section>

          <section
            @click="openServerConnectOverlay"
            class="flex flex-row cursor-pointer border-t border-b border-[#CCCEDA] py-6"
          >
            <Checkbox :isChecked="!!config.serverDetails.ipAddress" />
            <div class="px-4">
              <h2 class="text-2xl text-[#A600D4] font-bold">Connect Mining Machine</h2>
              <p>
                Argon's mining software is runnable on cheap virtual cloud machines. We will guide you step-by-step
                through the process of spinning up a new server and installing the software.
              </p>
            </div>
          </section>
        </div>

        <button
          @click="launchMiningBot"
          :class="[
            walletIsFullyFunded && config.serverDetails.ipAddress
              ? 'text-white'
              : 'text-white/70 pointer-events-none opacity-30',
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
import basicEmitter from '../../emitters/basicEmitter';
import { useConfig } from '../../stores/config';
import { useWallets } from '../../stores/wallets';
import { useCurrency } from '../../stores/currency';
import Checkbox from '../../components/Checkbox.vue';
import { useInstaller } from '../../stores/installer';
import { createNumeralHelpers } from '../../lib/numeral';
import { bigIntMax } from '@argonprotocol/commander-calculator/src/utils';

dayjs.extend(utc);

const config = useConfig();
const installer = useInstaller();
const wallets = useWallets();
const currency = useCurrency();

const { microgonToArgonNm, micronotToArgonotNm } = createNumeralHelpers(currency);

const isLaunchingMiningBot = Vue.ref(false);

const walletIsPartiallyFunded = Vue.computed(() => {
  return (wallets.miningWallet.availableMicrogons || wallets.miningWallet.availableMicronots) > 0;
});

const additionalMicrogonsNeeded = Vue.computed(() => {
  return bigIntMax(config.biddingRules.requiredMicrogons - wallets.miningWallet.availableMicrogons, 0n);
});

const additionalMicronotsNeeded = Vue.computed(() => {
  return bigIntMax(config.biddingRules.requiredMicronots - wallets.miningWallet.availableMicronots, 0n);
});

const walletIsFullyFunded = Vue.computed(() => {
  if (!walletIsPartiallyFunded.value) {
    return false;
  }

  if (additionalMicrogonsNeeded.value) {
    return false;
  }

  if (additionalMicronotsNeeded.value) {
    return false;
  }

  return true;
});

function openBotOverlay() {
  basicEmitter.emit('openBotOverlay');
}

function openFundMiningAccountOverlay() {
  basicEmitter.emit('openWalletOverlay', { walletId: 'mining', screen: 'receive' });
}

function openServerConnectOverlay() {
  basicEmitter.emit('openServerConnectOverlay');
}

async function launchMiningBot() {
  if (isLaunchingMiningBot.value) {
    return;
  }
  isLaunchingMiningBot.value = true;
  config.isServerReadyToInstall = true;
  await config.save();
  await installer.run();
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
