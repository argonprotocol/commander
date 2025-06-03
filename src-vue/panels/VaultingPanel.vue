<template>
  <div class="flex flex-col h-full opacity-60 pointer-events-none">
    <div style="text-shadow: 1px 1px 0 white">
      <div class="text-5xl leading-tight font-bold text-center mt-20 text-[#4B2B4E]">
        Earn Revenue By Operating Vaults
        <div>And Funding Liquidity Pools</div>
      </div>
      <p class="text-base text-justify w-[780px] !mx-auto mt-10 text-[#4B2B4E]">
        Argon's Stabilization Vaults are the backbone of its enginuity. Bitcoins are locked into vaults, which generates unencumbered
        shorts on the argon stablecoin, which creates a currency that is impossible to death-spiral. Vaulters earn rewards by operating
        these vaults and managing liquidity pools. Anyone can participate in these liqudity pools and earn continuous
        yield on their argons.  
      </p>
    </div>
    <div class="flex flex-row items-center text-2xl mt-10 w-full justify-center">
      <button class="opacity-60 bg-argon-500 hover:bg-argon-600 border border-argon-700 inner-button-shadow font-bold text-white px-14 py-2 rounded-lg cursor-pointer">
        Operate a Stabilization Vault
      </button>
      <div class="text-xl font-bold text-slate-400 px-7">OR</div>
      <button class="opacity-60 bg-argon-500 hover:bg-argon-600 border border-argon-700 inner-button-shadow font-bold text-white px-14 py-2 rounded-lg cursor-pointer">
        Fund a Liquidity Pool
      </button>
    </div>
    
    <div class="flex-grow flex flex-row items-end w-full">
      <div class="flex flex-col w-full px-5 pb-5">
        <ul class="flex flex-row text-center text-sm text-[#4B2B4E] w-full py-7 border-t border-b border-slate-300 mb-5">
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="isLoaded">
                {{ vaultCount }}
              </template>
              <template v-else>
                ---
              </template>
            </div>
            <div>Active Vaults</div>
          </li>
          <li style="width: 1px" class="bg-slate-300"></li>
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="isLoaded">
                <span :class="[currencySymbol === '₳' ? 'font-semibold' : 'font-bold']">{{currencySymbol}}</span>{{ fmtMoney(argonTo(valueInVaults), 1_000) }}
              </template>
              <template v-else>
                ---
              </template>
            </div>
            <div>Total Value In Vaults</div>
          </li>
          <li style="width: 1px" class="bg-slate-300"></li>
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="isLoaded">
                {{ fmtMoney(Math.min(annualVaultAPY, 999_999), 100) }}%{{ annualVaultAPY >= 9_999? '+' : ' ' }}
              </template>
              <template v-else>
                ---
              </template>
            </div>
            <div>Average Vault APY</div>
          </li>
          <li style="width: 1px" class="bg-slate-300"></li>
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="isLoaded">
                {{ fmtCommas(fmtDecimalsMax(Math.min(annualPoolAPY, 999_999))) }}%{{ annualPoolAPY >= 9_999? '+' : ' ' }}
              </template>
              <template v-else>
                ---
              </template>
            </div>
            <div>Annual Pool APY</div>
          </li>
        </ul>
        <ul class="flex flex-row w-full overflow-x-hidden relative h-[117px]">
          <div class="flex flex-row h-full animate-scroll" :class="{ 'animate-paused': !isLoaded }">
            <template v-for="i in cloneCount" :key="'clone'+i">
              <template v-for="vault in vaults" :key="vault.idx">
                <li class="flex flex-row rounded-lg bg-white/30 mr-4 h-full">
                  <VaultImage class="relative h-full opacity-60 z-10" />
                  <div class="flex flex-col border-l-0 border border-slate-400/50 px-2 rounded-r-lg w-80">
                    <table class="w-full h-full">
                      <tbody>
                        <tr>
                          <td class="font-bold pl-1 pr-5 text-slate-800/70" colspan="2">
                            <header>Stabilization Vault #{{ vault.idx }}</header>
                          </td>
                        </tr>
                        <tr>
                          <td class="border-t border-slate-600/20 pl-1 font-bold text-sm text-slate-600/50">
                            Bitcoins
                          </td>
                          <td class="border-t border-slate-600/20 w-full pr-1">
                            <div class="relative w-full bg-slate-500/10 border border-slate-400 rounded h-5">
                              <div class="absolute left-[-1px] top-[-1px] h-[calc(100%+2px)] bg-white/90 border border-slate-500 rounded" style="width: 10%"></div>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td class="border-t border-slate-600/20 pl-1 font-bold text-sm text-slate-600/50">
                            Liquidity
                          </td>
                          <td class="border-t border-slate-600/20 w-full pr-1">
                            <div class="relative w-full bg-slate-500/10 border border-slate-400 rounded h-5">
                              <div class="absolute left-[-1px] top-[-1px] h-[calc(100%+2px)] bg-white/90 border border-slate-500 rounded" style="width: 50%"></div>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </li>
              </template>
            </template>
          </div>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { fmtMoney, fmtCommas, fmtDecimalsMax } from '../lib/Utils';
import { useBlockchainStore } from '../stores/blockchain';
import { useConfigStore } from '../stores/config';
import { storeToRefs } from 'pinia';
import { IVault } from '@argonprotocol/commander-calculator';
import VaultImage from '../assets/vault.svg';
import { getMainchain } from '../lib/mainchain';

const mainchain = getMainchain();

const blockchainStore = useBlockchainStore();
const configStore = useConfigStore();

const { argonTo, btcToArgon } = configStore;
const { currencySymbol } = storeToRefs(configStore);

const isLoaded = Vue.ref(false);

const vaults = Vue.ref<IVault[]>([]);

const cloneCount = Vue.computed(() => {
  const minVaults = 6;
  return Math.ceil(minVaults / Math.max(1, vaults.value.length));
});

const vaultCount = Vue.ref(0);
const valueInVaults = Vue.ref(0);
const annualVaultAPY = Vue.ref(350);
const annualPoolAPY = Vue.ref(72);

Vue.onMounted(async () => {
  vaults.value = await mainchain.fetchVaults();
  vaultCount.value = vaults.value.length;
  valueInVaults.value = btcToArgon(vaults.value.reduce((acc, vault) => acc + vault.bitcoinLocked, 0));
  isLoaded.value = true;
});
</script>

<style scoped>
@keyframes scroll {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}

.animate-scroll {
  animation: scroll 60s linear infinite;
  display: flex;
  will-change: transform;
  animation-play-state: running;
}

.animate-paused {
  animation-play-state: paused;
}

.animate-scroll:hover {
  animation-play-state: paused;
}
</style>