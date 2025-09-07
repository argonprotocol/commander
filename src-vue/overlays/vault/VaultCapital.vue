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
          :align="props.align ?? 'center'"
          side="bottom"
          class="text-md data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade data-[state=delayed-open]:data-[side=right]:animate-slideLeftAndFade data-[state=delayed-open]:data-[side=left]:animate-slideRightAndFade data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade pointer-events-none z-100 rounded-lg border border-gray-800/20 bg-white px-5 pt-4 pb-2 text-left leading-5.5 text-gray-600 shadow-xl will-change-[transform,opacity]"
          :style="{ width: props.width }"
        >
          <p>
            This box shows the breakdown of Argons you are committing to this Vault. Capital is used both as collateral
            for Liquid Locked Bitcoins, and as funding for Treasury Pools. The settings on this page allow you to
            configure the percent allocations.
          </p>

          <p>
            In addition to your personal capital, Vaults allow you to solicit external investment to fund your Treasury
            Pools as well as to fill your Vault with Bitcoin. You choose the profit distribution and fees for these
            respective services.
          </p>

          <table class="relative z-50 mt-2 h-full w-full table-fixed whitespace-nowrap">
            <tbody>
              <tr class="text-argon-600 h-1/3">
                <td class="w-5/12"></td>
                <td class="text-argon-800/40 w-5/12 text-right font-sans font-light">You're Committing</td>
                <td class="text-argon-800/40 w-5/12 text-right font-sans font-light">You're Soliciting</td>
              </tr>
              <tr class="text-argon-600 h-1/3 font-mono font-bold">
                <td
                  class="text-argon-800/40 border-t border-dashed border-slate-300 pr-10 pl-2 text-left font-sans font-light"
                >
                  Bitcoin Securitization
                </td>
                <td class="border-t border-dashed border-slate-300 text-right">
                  {{ currency.symbol }}{{ microgonToMoneyNm(calculator.calculateSecuritization()).format('0,0') }}
                </td>
                <td class="border-t border-dashed border-slate-300 text-right">n/a</td>
              </tr>
              <tr class="text-argon-600 h-1/3 font-mono font-bold">
                <td
                  class="text-argon-800/40 border-t border-dashed border-slate-300 pr-10 pl-2 text-left font-sans font-light"
                >
                  Treasury Pool
                </td>
                <td class="border-t border-dashed border-slate-300 text-right">
                  {{ currency.symbol }}{{ microgonToMoneyNm(internalPoolCapital).format('0,0') }}
                </td>
                <td class="border-t border-dashed border-slate-300 text-right">
                  {{ currency.symbol }}{{ microgonToMoneyNm(poolSpace - internalPoolCapital).format('0,0') }}
                </td>
              </tr>
              <tr class="text-argon-600 h-1/3 font-mono font-bold">
                <td
                  class="text-argon-800/40 border-t-2 border-dashed border-slate-300 pr-10 pl-2 text-left font-sans font-light"
                >
                  Value of Locked Bitcoin
                </td>
                <td class="border-t-2 border-dashed border-slate-300 text-right">
                  ({{ currency.symbol }}{{ microgonToMoneyNm(calculator.personalBtcInMicrogons()).format('0,0') }})
                </td>
                <td class="border-t-2 border-dashed border-slate-300 text-right">
                  {{ currency.symbol
                  }}{{
                    microgonToMoneyNm(
                      calculator.calculateBtcSpaceInMicrogons() - calculator.personalBtcInMicrogons(),
                    ).format('0,0')
                  }}
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
import { TooltipArrow, TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui';
import { getVaultCalculator } from '../../stores/mainchain.ts';
import { useConfig } from '../../stores/config.ts';
import { useCurrency } from '../../stores/currency.ts';
import { createNumeralHelpers } from '../../lib/numeral.ts';

const props = withDefaults(
  defineProps<{
    align?: 'start' | 'end' | 'center';
    alignOffset?: number;
    width?: string;
    fromOverlay?: boolean;
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

const btcSpaceAvailable = Vue.ref(0n);
const poolSpace = Vue.ref(0n);
const internalPoolCapital = Vue.ref(0n);
const securitization = Vue.ref(0n);

function updateAPYs() {
  console.log('update apy');
  btcSpaceAvailable.value = calculator.calculateBtcSpaceInMicrogons();
  securitization.value = calculator.calculateSecuritization();

  poolSpace.value = calculator.calculateTotalPoolSpace('Full');
  internalPoolCapital.value = calculator.calculateInternalPoolCapital();
}

Vue.onMounted(() => {
  calculator.load(rules.value).then(updateAPYs);
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
