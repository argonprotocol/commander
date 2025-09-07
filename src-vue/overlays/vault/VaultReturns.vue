<template>
  <TooltipProvider :disableHoverableContent="true" :delayDuration="0">
    <TooltipRoot>
      <TooltipTrigger asChild>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side-offset="-5"
          :align-offset="alignOffset ?? 0"
          side="bottom"
          :align="props.align ?? 'center'"
          class="text-md data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade data-[state=delayed-open]:data-[side=right]:animate-slideLeftAndFade data-[state=delayed-open]:data-[side=left]:animate-slideRightAndFade data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade pointer-events-none z-100 rounded-lg border border-gray-800/20 bg-white px-5 pt-4 pb-2 text-left leading-5.5 text-gray-600 shadow-xl will-change-[transform,opacity]"
          :style="{ width: props.width }"
        >
          <p v-if="rules.personalBtcPct < 100">
            Your future return depends on two major factors: 1) how much bitcoin is locked into your vault, and 2) how
            much you are then able to activate in the treasury pools.
          </p>
          <p v-else-if="rules.capitalForTreasuryPct < 50">
            Your future return depends on how much external capital is raised in your treasury pools.
          </p>
          <p v-else>
            You're currently locking 100% of BTC Space and 100% of Treasury Pool Space. Your returns will be dependent
            on the growth of the Mining Auctions relative to your {{ poolProrata }}% prorata of the pool.
          </p>

          <p v-if="rules.personalBtcPct < 100">
            You're currently locking {{ rules.personalBtcPct }}% of the Bitcoin Securitization in your Vault, which will
            mint {{ currency.symbol }}{{ microgonToMoneyNm(calculator.personalBtcInMicrogons()).format('0,0') }} to you.
          </p>

          <p v-if="rules.capitalForTreasuryPct < 50">
            <template v-if="rules.personalBtcPct < 100">Another</template>
            <template v-else>The biggest</template>
            impact on profits is the amount of the Treasury Pool you are able to activate. You are currently leaving
            {{ currency.symbol
            }}{{ microgonToMoneyNm(poolSpace - calculator.calculateInternalPoolCapital()).format('0,0') }} to be raised
            by external parties.
          </p>

          <p>Below is an APY breakdown with various combinations of utilization:</p>

          <table class="relative z-50 mt-2 h-full w-full table-fixed whitespace-nowrap">
            <tbody>
              <tr class="text-argon-600 h-1/3">
                <td class="w-5/12"></td>
                <td class="text-argon-800/40 w-5/12 pl-5 text-right font-sans font-light">Low BTC Utilization</td>
                <td class="text-argon-800/40 w-5/12 pl-5 text-right font-sans font-light">High BTC Utilization</td>
              </tr>
              <tr class="text-argon-600 h-1/3 font-mono font-bold">
                <td
                  class="text-argon-800/40 border-t border-dashed border-slate-300 pr-10 pl-2 text-left font-sans font-light"
                >
                  Low Pool Utilization
                </td>
                <td class="border-t border-dashed border-slate-300 text-right">
                  {{ numeral(apyGrid.get('Low-Low')).formatIfElseCapped('>=100', '0,0', '0,0.00', 999_999) }}%
                </td>
                <td class="border-t border-dashed border-slate-300 text-right">
                  {{ numeral(apyGrid.get('High-Low')).formatIfElseCapped('>=100', '0,0', '0,0.00', 999_999) }}%
                </td>
              </tr>
              <tr class="text-argon-600 h-1/3 font-mono font-bold">
                <td
                  class="text-argon-800/40 border-t border-dashed border-slate-300 pr-10 pl-2 text-left font-sans font-light"
                >
                  High Pool Utilization
                </td>
                <td class="border-t border-dashed border-slate-300 text-right">
                  {{ numeral(apyGrid.get('Low-High')).formatIfElseCapped('>=100', '0,0', '0,0.00', 999_999) }}%
                </td>
                <td class="border-t border-dashed border-slate-300 text-right">
                  {{ numeral(apyGrid.get('High-High')).formatIfElseCapped('>=100', '0,0', '0,0.00', 999_999) }}%
                </td>
              </tr>
            </tbody>
          </table>

          <TooltipArrow :width="24" :height="12" class="fill-white stroke-gray-400/50 shadow-2xl" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useConfig } from '../../stores/config';
import { useCurrency } from '../../stores/currency';
import numeral, { createNumeralHelpers } from '../../lib/numeral';
import { TooltipArrow, TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui';
import { getMainchainClients, getVaultCalculator } from '../../stores/mainchain.ts';
import { Vaults } from '../../lib/Vaults.ts';
import BigNumber from 'bignumber.js';

const props = withDefaults(
  defineProps<{
    align?: 'start' | 'end' | 'center';
    alignOffset?: number;
    width?: string;
  }>(),
  {
    width: '700px',
  },
);

const calculator = getVaultCalculator();

const config = useConfig();
const currency = useCurrency();
const { microgonToMoneyNm } = createNumeralHelpers(currency);

const rules = Vue.computed(() => config.vaultingRules);

const apyGrid = new Map<string, number>();

const btcSpaceAvailable = Vue.ref(0n);
const poolSpace = Vue.ref(0n);
const existingPoolCapital = Vue.ref(0n);
const poolProrata = Vue.computed(() => {
  const prorata = BigNumber(poolSpace.value)
    .div(poolSpace.value + existingPoolCapital.value)
    .times(100);
  return Number(prorata.toFixed(2));
});

function updateAPYs() {
  btcSpaceAvailable.value = calculator.calculateBtcSpaceInMicrogons();

  for (const btcUtilization of ['Low', 'High'] as const) {
    for (const poolUtilization of ['Low', 'High'] as const) {
      const key = `${btcUtilization}-${poolUtilization}`;
      apyGrid.set(key, calculator.calculateInternalAPY(btcUtilization, poolUtilization));
    }
  }

  poolSpace.value = calculator.calculateTotalPoolSpace('High');
}

Vue.onMounted(async () => {
  calculator.load(rules.value).then(updateAPYs);
  const clients = getMainchainClients();
  Vaults.getTotalActivatedCapital(clients).then(x => {
    existingPoolCapital.value = x.totalActivatedCapital;
  });
});
Vue.watch(
  rules,
  () => {
    updateAPYs();
  },
  { deep: true },
);
</script>

<style scoped>
@reference "../../main.css";

table td {
  @apply py-2;
}

p {
  @apply mb-4;
}
</style>
