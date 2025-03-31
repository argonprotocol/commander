<template>
  <ul>
    <li v-for="transaction in transactions" :key="transaction.id">
      {{ transaction.type }}
    </li>
  </ul>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useAccountStore } from '../../stores/account';
import { addCommas } from '../../lib/Utils';
import { storeToRefs } from 'pinia';

const accountStore = useAccountStore();
const { argonTo, argonotTo } = accountStore;
const { currencySymbol, argonBalance, argonotBalance } = storeToRefs(accountStore);

const accountAddress = '5EbtpegDiogFpFS9PTRvcXn166c7PbwgADm6bwc92bcDCh3U';
const transactions: Vue.Ref<any[]> = Vue.ref([]);

async function fetchTransactions() {
  const response = await fetch(`https://argon-api.statescan.io/accounts/${accountAddress}/transfers?page=0&page_size=25`);
  const data = await response.json();

  for (const item of data.items) {
    const transaction = {
      blockHash: item.indexer.blockHash,
      blockTime: item.indexer.blockTime,
      from: item.from,
      to: item.to,
      type: item.from === accountAddress ? 'sent' : 'received',
    }
    transactions.value.push(transaction);
  }
}

Vue.onMounted(async () => {
  await fetchTransactions();
});
</script>