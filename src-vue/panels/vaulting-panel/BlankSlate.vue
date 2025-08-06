<!-- prettier-ignore -->
<template>
  <div class="flex flex-col h-full">
    <div style="text-shadow: 1px 1px 0 white">
      <div class="text-5xl leading-tight font-bold text-center mt-20 text-[#4B2B4E]">
        Earn Revenue By Operating
        <div>Stabilization Vaults for the Network</div>
      </div>
      <p class="text-base text-justify w-[780px] !mx-auto mt-10 text-[#4B2B4E]">
        Argon's Stabilization Vaults are the backbone of its ingenuity. Bitcoins are locked into vaults, which generates
        unencumbered shorts on the argon stablecoin, which creates a currency that is impossible to death-spiral.
        Vaulters earn rewards by operating these vaults and managing liquidity pools. Anyone can participate in these
        liquidity pools and earn continuous yield on their argons.
      </p>
    </div>
    <div class="flex flex-row items-center text-2xl mt-10 w-full justify-center">
      <button
        @click="openConfigureStabilizationVaultOverlay"
        class="bg-argon-500 hover:bg-argon-600 border border-argon-700 inner-button-shadow font-bold text-white px-14 py-2 rounded-lg cursor-pointer"
      >
        Create Stabilization Vault
      </button>
    </div>

    <div class="flex-grow flex flex-row items-end w-full">
      <div class="flex flex-col w-full px-5 pb-5">
        <ul
          class="flex flex-row text-center text-sm text-[#4B2B4E] w-full py-7 border-t border-b border-slate-300 mb-5"
        >
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="isLoaded">
                {{ vaultCount }}
              </template>
              <template v-else>---</template>
            </div>
            <div>Active Vaults</div>
          </li>
          <li style="width: 1px" class="bg-slate-300"></li>
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="isLoaded">
                {{ numeral(bitcoinLocked).format('0,0.[00000000]') }}
              </template>
              <template v-else>---</template>
            </div>
            <div>Bitcoin In Vaults</div>
          </li>
          <li style="width: 1px" class="bg-slate-300"></li>
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="isLoaded">
                <span :class="[currency.symbol === '₳' ? 'font-semibold' : 'font-bold']">
                  {{ currency.symbol }}
                </span>
                <span>{{ microgonToMoneyNm(microgonValueInVaults).formatIfElse('< 1_000', '0,0.00', '0,0') }}</span>
              </template>
              <template v-else>---</template>
            </div>
            <div>Total Value In Vaults</div>
          </li>
          <li style="width: 1px" class="bg-slate-300"></li>
          <li class="w-1/4">
            <div class="text-4xl font-bold">
              <template v-if="isLoaded">
                {{ numeral(averageVaultAPY).formatIfElseCapped('< 1_000', '0,0.00', '0,0', 9_999) }}%
              </template>
              <template v-else>---</template>
            </div>
            <div>Average Vault APY</div>
          </li>
        </ul>
        <ul class="flex flex-row w-full overflow-x-hidden relative h-[117px]">
          <div class="flex flex-row h-full animate-scroll" :class="{ 'animate-paused': !isLoaded }">
            <template v-for="i in cloneCount" :key="'clone' + i">
              <template v-for="vault in vaults" :key="vault.id">
                <li class="flex flex-row rounded-lg bg-white/30 mr-4 h-full">
                  <VaultImage class="relative h-full opacity-60 z-10" />
                  <div class="flex flex-col border-l-0 border border-slate-400/50 px-2 rounded-r-lg w-80">
                    <table class="w-full h-full">
                      <tbody>
                        <tr>
                          <td class="font-bold pl-1 pr-5 text-slate-800/70" colspan="2">
                            <header>Stabilization Vault #{{ vault.id }}</header>
                          </td>
                        </tr>
                        <tr>
                          <td class="border-t border-slate-600/20 pl-1 font-bold text-sm text-slate-600/50">
                            Bitcoins
                          </td>
                          <td class="border-t border-slate-600/20 w-full pr-1">
                            <div class="relative w-full bg-slate-500/10 border border-slate-400 rounded h-5">
                              <div
                                class="absolute left-[-1px] top-[-1px] h-[calc(100%+2px)] bg-white/90 border border-slate-500 rounded"
                                :style="{ width: vault.btcFillPct + '%' }"
                              ></div>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td class="border-t border-slate-600/20 pl-1 font-bold text-sm text-slate-600/50">
                            Liquidity
                          </td>
                          <td class="border-t border-slate-600/20 w-full pr-1">
                            <div class="relative w-full bg-slate-500/10 border border-slate-400 rounded h-5">
                              <div
                                class="absolute left-[-1px] top-[-1px] h-[calc(100%+2px)] bg-white/90 border border-slate-500 rounded"
                                :style="{ width: vault.liquidityFillPct + '%' }"
                              ></div>
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
import basicEmitter from '../../emitters/basicEmitter';
import { useCurrency } from '../../stores/currency';
import VaultImage from '../../assets/vault.svg?component';
import numeral, { createNumeralHelpers } from '../../lib/numeral';

import { useVaults } from '../../stores/vaults.ts';
import { SATOSHIS_PER_BITCOIN } from '../../lib/Currency.ts';
import { getMainchain } from '../../stores/mainchain.ts';

const currency = useCurrency();

const vaultCount = Vue.ref(0);

const { microgonToMoneyNm } = createNumeralHelpers(currency);

const isLoaded = Vue.ref(false);

const cloneCount = Vue.computed(() => {
  const minVaults = 6;
  return Math.ceil(minVaults / Math.max(1, vaultCount.value));
});

const vaults = Vue.ref([] as { id: number; btcFillPct: number; liquidityFillPct: number }[]);
const bitcoinLocked = Vue.ref(0);
const microgonValueInVaults = Vue.ref(0n);
/**
 * Get btc revenue from last 10 days and add liquidity pool revenue from last 10 days. Multiply by 365 and divide by capital contributed.
 */
const averageVaultAPY = Vue.ref(0);

function openConfigureStabilizationVaultOverlay() {
  basicEmitter.emit('openConfigureStabilizationVaultOverlay');
}

const vaultsStore = useVaults();
Vue.onMounted(async () => {
  try {
    const mainchain = getMainchain();
    await vaultsStore.load();
    const frameToLoadPoolEarnings = (await mainchain.getCurrentFrameId()) - 1;
    const list = Object.values(vaultsStore.vaultsById);
    const vaultApys: number[] = [];
    for (const entry of vaults.value) {
      const vault = vaultsStore.vaultsById[entry.id];

      const yearFeeRevenue = Number(vaultsStore.getTrailingYearVaultRevenue(entry.id));
      const activatedSecuritization = Number(vault.activatedSecuritization());

      const epochPoolCapital = Number(vaultsStore.contributedCapital(entry.id, frameToLoadPoolEarnings, 10));
      entry.liquidityFillPct = Math.round((epochPoolCapital / activatedSecuritization) * 100);

      const epochPoolEarnings = Number(vaultsStore.poolEarnings(entry.id, frameToLoadPoolEarnings, 10));
      const epochPoolEarningsRatio = epochPoolEarnings / epochPoolCapital;

      const poolApy = (1 + epochPoolEarningsRatio) ** 36.5 - 1;
      const feeApr = yearFeeRevenue / Number(vault.securitization);

      const apy = poolApy + feeApr;
      vaultApys.push(apy);
    }
    if (vaultApys.length > 0) {
      averageVaultAPY.value = vaultApys.reduce((a, b) => a + b, 0) / vaultApys.length;
    } else {
      averageVaultAPY.value = 0;
    }
    vaultCount.value = list.length;
    const satsLocked = vaultsStore.getTotalSatoshisLocked();
    bitcoinLocked.value = Number(satsLocked) / Number(SATOSHIS_PER_BITCOIN);
    vaultsStore
      .getMarketRate(satsLocked)
      .then(rate => {
        microgonValueInVaults.value = rate;
      })
      .catch(() => {
        microgonValueInVaults.value = 0n;
      });
    vaults.value = list.map(vault => {
      const maxSpace = vault.securitization - vault.recoverySecuritization();
      const bitcoinSpaceUsed = maxSpace - vault.availableBitcoinSpace();

      return {
        id: vault.vaultId,
        btcFillPct: Math.round((Number(bitcoinSpaceUsed) / Number(maxSpace)) * 100),
        liquidityFillPct: 0,
      };
    });
    isLoaded.value = true;
  } catch (error) {
    console.error('Error loading vaults:', error);
  }
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
