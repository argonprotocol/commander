<template>
  <div class="absolute top-10 w-[570px] right-[33.3%] bottom-10 z-100 bg-argon-menu-bg border border-black/30 rounded shadow-xl flex flex-col gap-6 px-5 pt-5 pb-3 text-md">
    <div class="flex flex-col gap-2 grow">
      <h4 class="font-bold text-xl whitespace-nowrap">Bid Breakdown for {{scenarioName}} Annual Percentage Rate</h4>

      <div class="w-full h-[1px] bg-slate-700/60 my-1"></div>
      <table class="w-full">
        <thead>
          <tr>
            <th colspan="2">Per-Seat Stake</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{{ data.argonotsRequiredForBid }} ARGNOTs</td>
            <td>{{currencySymbol}}{{ addCommas(argonotTo(data.argonotsRequiredForBid), 2) }}</td>
          </tr>
          <tr>
            <td>Expected Change In Price</td>
            <td>{{ data.argonotPriceChange > 0 ? '+' : '' }}{{ data.argonotPriceChange.toFixed(2) }}%</td>
          </tr>
          <tr>
            <td>ARGNOT Staking Cost</td>
            <td>{{currencySymbol}}{{ addCommas(argonTo(data.costOfArgonotLoss), 2) }}</td>
          </tr>
        </tbody>
      </table>

      <table class="w-full">
        <thead>
          <tr>
            <th colspan="2">Per-Seat Cost</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>ARGNOT Staking Cost</td>
            <td>{{currencySymbol}}{{ addCommas(argonTo(data.costOfArgonotLoss), 2) }}</td>
          </tr>
          <tr>
            <td>ARGN Bid Premium</td>
            <td>{{currencySymbol}}{{addCommas(argonTo(data.argonBidPremium), 2)}}</td>
          </tr>
          <tr>
            <td>Transaction Fee</td>
            <td>{{currencySymbol}}{{addCommas(argonTo(data.transactionFee), 2)}}</td>
          </tr>
          <tr>
            <td>TOTAL COST</td>
            <td>{{currencySymbol}}{{addCommas(argonTo(data.totalCost), 2)}}</td>
          </tr>
        </tbody>
      </table>

      <table class="w-full">
        <thead>
          <tr>
            <th colspan="2">Expected Per-Seat Rewards</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{{addCommas(data.argonRewardsForThisSeat, data.argonRewardsForThisSeat >= 100 ? 0 : 1)}} ARGN Block Rewards</td>
            <td>{{currencySymbol}}{{addCommas(argonTo(data.argonRewardsForThisSeat), 2)}}</td>
          </tr>
          <tr>
            <td>{{addCommas(data.argonotRewardsForThisSeat, data.argonotRewardsForThisSeat >- 100 ? 0 : 1)}} ARGNOT Block Rewards</td>
            <td>{{currencySymbol}}{{addCommas(argonTo(data.argonotRewardsAsArgonValue), 2)}}</td>
          </tr>
          <tr>
            <td>{{addCommas(data.argonsToMintThisSeat, data.argonsToMintThisSeat >= 100 ? 0 : 1)}} ARGNs Expected to Mint</td>
            <td>{{currencySymbol}}{{addCommas(argonTo(data.argonsToMintThisSeat), 2)}}</td>
          </tr>
          <tr>
            <td>TOTAL REWARDS</td>
            <td>{{currencySymbol}}{{addCommas(argonTo(data.totalRewards), 2)}}</td>
          </tr>
        </tbody>
      </table>

      <table class="w-full mt-2">
        <thead class="font-bold">
          <tr>
            <td>Ten Day Percentage Rate (TDPR)</td>
            <td>{{addCommas(Math.min(data.TDPR, 999_999_999_999), 0)}}{{ data.TDPR > 999_999_999_999 ? '+' : '' }}%</td>
          </tr>
          <tr>
            <td>Annual Percentage Rate (APR)</td>
            <td>{{addCommas(Math.min(data.APR, 999_999_999_999), 0)}}{{ data.APR > 999_999_999_999 ? '+' : '' }}%</td>
          </tr>
          <tr>
            <td>Annual Percentage Yield (APY)</td>
            <td>{{addCommas(Math.min(data.APY, 999_999_999_999), 0)}}{{ data.APY > 999_999_999_999 ? '+' : '' }}%</td>
          </tr>
        </thead>
      </table>

    </div>
    <p class="pb-2">* Some of these numbers will vary across seats due to randomness. Although they will achieve eventual consistancy over the long-run, it is not guranteed within a single slot window.</p>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useAccountStore } from '../stores/account';
import { storeToRefs } from 'pinia';
import { addCommas } from '../lib/Utils';

const accountStore = useAccountStore();
const { argonTo, argonotTo } = accountStore;
const { currencySymbol } = storeToRefs(accountStore);

const props = defineProps({
  data: {
    type: Object,
    required: true
  }
});

const data = props.data;

const scenarioName = Vue.computed(() => {
  return props.data.scenarioName[0].toUpperCase() + props.data.scenarioName.slice(1);
});
</script>

<style scoped>
@reference "../main.css";

table {
  border-collapse: collapse;

  td, th {
    padding: 4px 0;
    border-bottom: 1px solid #ccc;
  }

  th {
    padding-top: 15px;
  }

  td:last-child {
    text-align: right;
  }
}

</style>