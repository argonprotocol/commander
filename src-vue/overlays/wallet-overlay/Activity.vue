<template>
  <ul>
    <li v-for="transaction in transactions" :key="transaction.id">
      {{ transaction.direction }}
    </li>
  </ul>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useConfig } from '../../stores/config';
import { useCurrencyStore, IWallet } from '../../stores/currency';

const props = defineProps({
  walletId: {
    type: String as Vue.PropType<'mng' | 'llb' | 'vlt'>,
    required: true,
  },
});

const config = useConfig();
const currencyStore = useCurrencyStore();

const transactions: Vue.Ref<any[]> = Vue.ref([]);

async function fetchTransactions() {
  const wallet = currencyStore[props.walletId as keyof typeof currencyStore] as IWallet;
  const accountAddress = wallet.address;
  const response = await fetch(
    `https://argon-api.statescan.io/accounts/${accountAddress}/transfers?page=0&page_size=25`,
  );
  const data = await response.json();

  console.log(data);

  for (const item of data.items) {
    let direction = 'unknown';
    if (item.from === accountAddress) {
      direction = 'sent';
    } else if (item.to === accountAddress) {
      direction = 'received';
    } else {
      console.log('ITEM DOES NOT MATCH: ', item);
    }

    const transaction = {
      blockHash: item.indexer.blockHash,
      blockTime: item.indexer.blockTime,
      from: item.from,
      to: item.to,
      direction,
    };
    transactions.value.push(transaction);
  }
}

Vue.onMounted(async () => {
  await fetchTransactions();
});
</script>
