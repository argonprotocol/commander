<!-- prettier-ignore -->
<template>
  <ul>
    <li v-for="transaction in transactions" :key="transaction.id">
      {{ transaction.direction }}
    </li>
  </ul>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { IWallet, useWallets } from '../../stores/wallets';

const props = defineProps({
  walletId: {
    type: String as Vue.PropType<'mng' | 'llb' | 'vlt'>,
    required: true,
  },
});

const wallets = useWallets();

const transactions: Vue.Ref<any[]> = Vue.ref([]);

async function fetchTransactions() {
  const wallet = wallets[props.walletId as keyof typeof wallets] as IWallet;
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
