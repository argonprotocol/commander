<template>
  <HoverCardRoot :openDelay="0" :closeDelay="0" class="relative pointer-events-auto" v-model:open="isOpen">
    <HoverCardTrigger class="cursor-pointer">
      <div
        v-if="!wallets.isLoaded"
        class="flex flex-row items-center gap-x-2 border text-argon-700 px-4 py-0.5 rounded-md border-slate-400/50 hover:bg-slate-400/10 h-[30px] focus:outline-none hover:border-slate-400/50"
      >
        Loading...
      </div>
      <div
        v-else-if="status === Status.WaitingForSetup || status === Status.WaitingForFunding"
        class="flex flex-row items-center gap-x-2 border text-argon-600/70 px-4 py-0.5 rounded-md hover:bg-slate-400/10 h-[30px] focus:outline-none hover:border-slate-400/50"
        :class="[isOpen ? 'border-slate-400/60 bg-slate-400/10' : 'border-slate-400/50']"
      >
        <div ref="eyeballsElem" class="flex flex-row items-center gap-x-0.5 h-5 -ml-0.5">
          <div Eye class="relative w-3 h-full rounded-[100%] border border-argon-600/70">
            <div
              Eyeball
              :style="{
                left: `calc(${eyeballXPosition}% + ${eyeballXPosition / 50 - 1}px)`,
                top: `${eyeballYPosition}%`,
                transform: `translate(-${eyeballXPosition}%, -${eyeballYPosition}%)`,
              }"
              class="absolute w-[7px] h-[7px] rounded-full bg-argon-600/70"
            />
          </div>
          <div Eye class="relative w-3 h-full rounded-[100%] border border-argon-600/70">
            <div
              Eyeball
              :style="{
                left: `calc(${eyeballXPosition}% + ${eyeballXPosition / 50 - 1}px)`,
                top: `${eyeballYPosition}%`,
                transform: `translate(-${eyeballXPosition}%, -${eyeballYPosition}%)`,
              }"
              class="absolute w-[7px] h-[7px] rounded-full bg-argon-600/70"
            />
          </div>
        </div>
        Waiting for {{ status === Status.WaitingForSetup ? 'Setup' : 'Funding' }}
      </div>
      <div
        v-else-if="status === Status.Funded || status === Status.FullyFunded"
        class="flex flex-row items-center gap-x-2 border text-argon-600/70 px-3 py-0.5 rounded-md hover:bg-slate-400/10 h-[30px] focus:outline-none hover:border-slate-400/50"
        :class="[isOpen ? 'border-slate-400/60 bg-slate-400/10' : 'border-slate-400/50']"
      >
        <div class="w-5 h-5 relative text-argon-600 opacity-70">
          <StatusHappy />
          <Motion
            :animate="{ opacity: [0, 1, 0] }"
            :transition="{
              duration: 3,
              ease: 'easeInOut',
              repeat: Infinity,
              repeatDelay: 4,
              times: [0, 0.5, 1],
            }"
            class="absolute top-0 left-0 w-full h-full"
          >
            <StatusSmiling />
          </Motion>
        </div>
        {{ status === Status.Funded ? 'Funded' : 'Fully Funded' }}!
      </div>
      <div v-else-if="wallets.isLoaded" class="group cursor-pointer">
        <div
          v-if="status === Status.Underfunded"
          class="flex flex-row items-center gap-x-2 bg-red-500 border border-red-600 text-white px-4 py-0.5 rounded-md inner-button-shadow"
        >
          <div class="w-4 h-4">
            <StatusSad />
          </div>
          Underfunded
        </div>

        <div
          v-else-if="status === Status.Overfunded"
          class="flex flex-row items-center gap-x-2 bg-yellow-600/70 border border-yellow-600/60 text-white px-4 py-0.5 rounded-md inner-button-shadow"
        >
          <div class="w-4 h-4">
            <StatusNeutral />
          </div>
          Overfunded
        </div>
      </div>
      <div v-else class="text-gray-900 px-2">Loading...</div>
    </HoverCardTrigger>

    <HoverCardPortal>
      <HoverCardContent
        :align="'end'"
        :alignOffset="0"
        :sideOffset="-3"
        class="z-50 data-[side=bottom]:animate-slideUpAndFade data-[side=right]:animate-slideLeftAndFade data-[side=left]:animate-slideRightAndFade data-[side=top]:animate-slideDownAndFad data-[state=open]:transition-all"
      >
        <div
          class="flex flex-col shrink rounded bg-white text-md text-gray-900 shadow-lg ring-1 ring-gray-900/20 max-w-140 p-1"
        >
          <div
            v-if="!config.hasSavedBiddingRules && !config.hasSavedVaultingRules"
            class="flex flex-col gap-y-2 py-4 px-4 rounded-md text-slate-900/80 w-110"
          >
            <p>This is where you'll be notified of important alerts such as when your mining bot's capital runs low.</p>
            <table class="w-full text-left mt-3 whitespace-nowrap">
              <thead>
                <tr>
                  <th class="w-[20%]">Token</th>
                  <th class="w-[40%] text-right">Mining Wallet</th>
                  <th class="w-[40%] text-right">Vaulting Wallet</th>
                </tr>
              </thead>
              <tbody>
                <tr @click="openFundMiningAccountOverlay" class="group cursor-pointer">
                  <td class="group-hover:text-argon-600 group-hover:bg-argon-100/20">ARGN</td>
                  <td class="text-right group-hover:text-argon-600 group-hover:bg-argon-100/20">
                    {{ microgonToArgonNm(wallets.miningWallet.availableMicrogons).format('0,0.[00]') }}
                  </td>
                  <td class="text-right group-hover:text-argon-600 group-hover:bg-argon-100/20">
                    {{ microgonToArgonNm(wallets.vaultingWallet.availableMicrogons).format('0,0.[00]') }}
                  </td>
                </tr>
                <tr @click="openFundVaultingAccountOverlay" class="group cursor-pointer">
                  <td class="group-hover:text-argon-600 group-hover:bg-argon-100/20">ARGNOT</td>
                  <td class="text-right group-hover:text-argon-600 group-hover:bg-argon-100/20">
                    {{ micronotToArgonotNm(wallets.vaultingWallet.availableMicronots).format('0,0.[00]') }}
                  </td>
                  <td class="text-right group-hover:text-argon-600 group-hover:bg-argon-100/20">
                    {{ micronotToArgonotNm(wallets.miningWallet.availableMicronots).format('0,0.[00]') }}
                  </td>
                </tr>
              </tbody>
            </table>
            <motion
              as="div"
              :animate="{
                backgroundPosition: ['0% 0', '200% 0'],
              }"
              :transition="{
                duration: 2,
                ease: 'linear',
                repeat: Infinity,
                repeatType: 'loop',
              }"
              :style="{
                background: `linear-gradient(to right, #a600d4 0%, #EABDF7FF 50%, #a600d4 100%)`,
                backgroundSize: '200% 100%',
              }"
              class="w-full h-2.5 mt-1 opacity-50 rounded-sm"
            />
          </div>

          <div
            v-if="config.hasSavedBiddingRules"
            :class="[installer.isRunning ? 'opacity-50 pointer-events-none' : '']"
          >
            <div v-if="miningStatus === 'Funded'" class="py-5 px-6 rounded-md bg-slate-400/10">
              <header class="flex flex-row items-center gap-x-1 text-lg font-bold text-slate-600 whitespace-nowrap">
                <CheckboxIcon class="w-7 h-7 relative -left-0.5" />
                <span>Your Mining Account Is Fully Funded</span>
              </header>
              <p class="py-1 mt-px opacity-80">
                Your account has
                {{ micronotToArgonotNm(micronotsTotal).formatIfElse('< 100', '0,0.[000000]', '0,0.[00]') }}
                argonot{{
                  micronotToArgonotNm(micronotsTotal).formatIfElse('< 100', '0,0.[000000]', '0,0.[00]') === '1'
                    ? ''
                    : 's'
                }}
                and
                {{ microgonToArgonNm(microgonsTotal).formatIfElse('< 100', '0,0.[000000]', '0,0.[00]') }}
                argon{{
                  microgonToArgonNm(microgonsTotal).formatIfElse('< 100', '0,0.[000000]', '0,0.[00]') === '1' ? '' : 's'
                }}
                ({{
                  microgonToArgonNm(wallets.miningWallet.availableMicrogons).formatIfElse(
                    '< 100',
                    '0,0.[000000]',
                    '0,0.[00]',
                  )
                }}
                are currently available to spend), which gives your bot enough capital to fully operate. However, you
                can always add more capital.
              </p>
              <div class="flex flex-row gap-x-3 items-center mt-1">
                <div class="cursor-pointer text-argon-600" @click="openFundMiningAccountOverlay">Add More Capital</div>
                <div class="w-px h-4 bg-slate-400/80"></div>
                <div class="cursor-pointer text-argon-600" @click="openBotOverlay">Modify Bidding Rules</div>
              </div>
              <!-- <table class="w-full text-left mt-3 mb-5 whitespace-nowrap">
                <thead>
                  <tr>
                    <th class="w-[28%]">Base Capital</th>
                    <th class="w-[36%]">Reinvested</th>
                    <th class="text-right w-[36%]">Total Capital Committed</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      {{ microgonToArgonNm(config.biddingRules?.baseCapitalCommitment || 0n).format('0,0.[00000000]') }}
                      ARGNs
                    </td>
                    <td>{{ microgonToArgonNm(reinvestedEarnings || 0n).format('0,0.[00000000]') }} ARGNs</td>
                    <td class="text-right">
                      {{ microgonToArgonNm(totalBiddingBudget || 0n).format('0,0.[00000000]') }} ARGNs
                    </td>
                  </tr>
                </tbody>
              </table> -->
              <!-- <div class="flex flex-row gap-x-2 mt-2">
                <button
                  @click="openFundMiningAccountOverlay"
                  class="px-4 py-1.5 rounded-md border border-lime-600 text-lime-700/70 hover:bg-lime-600/10 cursor-pointer font-bold"
                >
                  Transfer More Tokens Into Mining
                </button>
              </div> -->
            </div>
            <div v-else-if="miningStatus === 'Underfunded'" class="bg-red-100/70 py-4 px-4 rounded-md">
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
            <div v-else class="bg-yellow-100/70 py-4 px-4 rounded-md">
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
          </div>

          <template v-if="config.hasSavedBiddingRules && config.hasSavedVaultingRules">
            <div class="h-px bg-gray-300/60 my-1" />
          </template>

          <template v-if="config.hasSavedVaultingRules">
            <div v-if="vaultingStatus === 'Funded'" class="py-4 px-4 rounded-md">
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
            <div v-else-if="vaultingStatus === 'Underfunded'" class="bg-red-100/70 py-4 px-4 rounded-md">
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
            <div v-else class="bg-yellow-500/10 py-4 px-4 rounded-md">
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
          </template>
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
import { useConfig } from '../stores/config';
import { useCurrency } from '../stores/currency';
import StatusSad from '../assets/status-sad.svg';
import StatusNeutral from '../assets/status-neutral.svg';
import StatusHappy from '../assets/status-happy.svg';
import StatusSmiling from '../assets/status-smiling.svg';
import CheckboxIcon from '../assets/checkbox.svg';
import { Motion } from 'motion-v';
import basicEmitter from '../emitters/basicEmitter';
import { createNumeralHelpers } from '../lib/numeral';
import { useStats } from '../stores/stats';
import { useInstaller } from '../stores/installer';

enum Status {
  WaitingForSetup = 'WaitingForSetup',
  WaitingForFunding = 'WaitingForFunding',
  Underfunded = 'Underfunded',
  Overfunded = 'Overfunded',
  Funded = 'Funded',
  FullyFunded = 'FullyFunded',
}
const statusOrder: Status[] = [
  Status.WaitingForSetup,
  Status.WaitingForFunding,
  Status.Funded,
  Status.Underfunded,
  Status.Overfunded,
];

const config = useConfig();
const wallets = useWallets();
const currency = useCurrency();
const installer = useInstaller();
const stats = useStats();
const { microgonToArgonNm, micronotToArgonotNm } = createNumeralHelpers(currency);

const isOpen = Vue.ref(false);

const eyeballsElem = Vue.ref<HTMLElement | null>(null);

const reinvestedEarnings = Vue.computed(() => {
  return stats.accruedMicrogonProfits;
});

const totalBiddingBudget = Vue.computed(() => {
  return (config.biddingRules?.baseCapitalCommitment || 0n) + reinvestedEarnings.value;
});

const microgonsTotal = Vue.computed(() => {
  return (
    wallets.miningWallet.availableMicrogons +
    stats.myMiningBids.microgonsBidTotal +
    stats.myMiningSeats.microgonsBidTotal
  );
});

const micronotsTotal = Vue.computed(() => {
  return wallets.miningWallet.availableMicronots + wallets.miningWallet.reservedMicronots;
});

const miningStatus = Vue.computed<Status>(() => {
  if (!config.hasSavedBiddingRules) {
    return Status.WaitingForSetup;
  } else if (!config.isServerReadyToInstall && wallets.miningWallet.availableMicrogons === 0n) {
    return Status.WaitingForFunding;
  }

  // const capitalCommited = config.biddingRules.baseCapitalCommitment + reinvestedEarnings.value;
  // const capitalFound = wallets.miningWallet.availableMicrogons + stats.myMiningBids.microgonsBid + stats.myMiningSeats.value;
  // if bot.maxSeatsPossible + stats.myMiningSeats.value > 10

  // if (wallets.miningWallet.microgonsBid < 1_000) {
  //   return 'underfunded';
  // }
  return Status.Funded;
});

const vaultingStatus = Vue.computed<Status>(() => {
  if (!config.hasSavedVaultingRules) {
    return Status.WaitingForSetup;
  } else if (!config.isVaultReadyToCreate && wallets.vaultingWallet.availableMicrogons === 0n) {
    return Status.WaitingForFunding;
  }

  return Status.Funded;
});

const status = Vue.computed<Status>(() => {
  if (miningStatus.value === Status.Funded && vaultingStatus.value === Status.Funded) {
    return Status.FullyFunded;
  }

  const indexOfMiningStatus = statusOrder.indexOf(miningStatus.value);
  const indexOfVaultingStatus = statusOrder.indexOf(vaultingStatus.value);
  const indexOfStatus = Math.max(indexOfMiningStatus, indexOfVaultingStatus);

  return statusOrder[indexOfStatus];
});

function openFundMiningAccountOverlay() {
  isOpen.value = false;
  basicEmitter.emit('openWalletOverlay', { walletId: 'mining', screen: 'receive' });
}

function openFundVaultingAccountOverlay() {
  isOpen.value = false;
  basicEmitter.emit('openWalletOverlay', { walletId: 'vaulting', screen: 'receive' });
}

function openBotOverlay() {
  isOpen.value = false;
  basicEmitter.emit('openBotOverlay');
}

function createStabilizationVault() {
  basicEmitter.emit('openConfigureStabilizationVaultOverlay');
}

const eyeballXPosition = Vue.ref(50);
const eyeballYPosition = Vue.ref(50);

// Mouse tracking functions
const handleMouseMove = (event: MouseEvent) => {
  if (!eyeballsElem.value) return;

  const eyeballsRect = eyeballsElem.value.getBoundingClientRect();
  const eyeballsCenterX = eyeballsRect.left + eyeballsRect.width / 2;
  const eyeballsCenterY = eyeballsRect.top + eyeballsRect.height / 2;

  const cursorX = event.clientX;
  const cursorY = event.clientY;

  // Calculate viewport dimensions
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Calculate distances from eyeballs center
  const distanceFromCenterX = cursorX - eyeballsCenterX;
  const distanceFromCenterY = cursorY - eyeballsCenterY;

  // Calculate max distances - X uses shorter distance for consistent sensitivity, Y uses direction-based
  const maxDistanceX = Math.min(eyeballsCenterX, viewportWidth - eyeballsCenterX);
  const maxDistanceY = distanceFromCenterY < 0 ? eyeballsCenterY : viewportHeight - eyeballsCenterY;

  // Map to eyeball positions relative to eyeballs center (50 = center)
  const xPercent = 50 + (distanceFromCenterX / maxDistanceX) * 50;
  const yPercent = 50 + (distanceFromCenterY / maxDistanceY) * 50;
  eyeballXPosition.value = Math.max(0, Math.min(100, xPercent));
  eyeballYPosition.value = Math.max(0, Math.min(100, yPercent));
};

// Lifecycle hooks
Vue.onMounted(() => {
  document.addEventListener('mousemove', handleMouseMove);
});

Vue.onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove);
});
</script>

<style scoped>
@reference "../main.css";

th {
  @apply text-gray-400 border-b border-gray-300/80 border-dashed py-2;
}

td {
  @apply border-b border-gray-300/80 border-dashed py-2;
}
</style>
