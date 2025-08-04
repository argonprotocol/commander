<template>
  <!-- <table class="relative h-full">
    <thead>
      <tr class="text-md text-gray-500 text-left table-fixed">
        <th class="py-2 border-b border-slate-400/30 pl-1 w-[15%]" :style="{ height: `${blocks.length + 1 / 100}%` }">
          Block
        </th>
        <th class="py-2 border-b border-slate-400/30 w-[30%]">Time</th>
        <th class="py-2 border-b border-slate-400/30 w-[20%]">Earned</th>
        <th class="py-2 border-b border-slate-400/30 w-[35%] text-right pr-3">Author</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="block in blocks" :key="block.number" class="text-gray-500">
        <td class="text-left border-t border-slate-400/30" :style="{ height: `${blocks.length + 1 / 100}%` }">
          ...{{ block.number.toString().slice(-4) }}
        </td>
        <td class="text-left border-t border-slate-400/30">
          {{ block.timestamp.fromNow() }}
        </td>
        <td class="text-left border-t border-slate-400/30">
          {{ currency.symbol
          }}{{
            microgonToMoneyNm(currency.micronotToMicrogon(block.micronots) + block.microgons).formatIfElse(
              '< 1_000',
              '0,0.00',
              '0,0',
            )
          }}
        </td>
        <td class="relative text-right border-t border-slate-400/30">
          <span>{{ abreviateAddress(block.author, 10) }}</span>
          <span v-if="isOurAddress(block.author)" class="absolute right-0 top-1/2 -translate-y-1/2 bg-argon-600 text-white px-1.5 pb-0.25 rounded text-sm">
            YOU
            <span class="absolute top-0 -left-3 inline-block h-full bg-gradient-to-r from-transparent to-white w-3"></span>
          </span>
        </td>
      </tr>
    </tbody>
  </table>
  <div v-if="!blocks.length" class="flex flex-col justify-center items-center grow pt-8">
    <span>
      <img src="/mining.gif" class="w-16 opacity-20 inline-block relative -left-1" />
    </span>
    <div class="flex flex-col items-center opacity-30 mt-5">
      <div class="text-lg font-bold">No Blocks Have Been Mined</div>
      <div>(miners are actively working on first block)</div>
    </div>
  </div> -->
</template>

<script setup lang="ts">
// let unsubscribeFromBlocks: any = null;

// function isOurAddress(address: string): boolean {
//   const ourSubAccount = accountset.subAccountsByAddress[address];
//   return !!ourSubAccount;
// }

// Vue.watch(
//   () => stats.dashboard.cohort,
//   async cohort => {
//     if (!cohort) return;
//     if (cohort.cohortId === currentCohortId.value) return;

//     if (unsubscribeFromBlocks) {
//       unsubscribeFromBlocks();
//       unsubscribeFromBlocks = null;
//     }

//     currentCohortId.value = cohort.cohortId;
//     const lastBlockNumber = cohort.progress === 100 ? cohort.lastBlockNumber : null;
//     const endingFrameId = cohort.cohortId + 10;
//     blocks.value = await blockchainStore.fetchBlocks(lastBlockNumber, endingFrameId, 8);

//     unsubscribeFromBlocks = await blockchainStore.subscribeToBlocks(newBlock => {
//       if (newBlock.number === blocks.value[0]?.number) return;
//       blocks.value.unshift(newBlock);
//       if (blocks.value.length > 8) {
//         blocks.value.pop();
//       }
//     });
//   },
// );
</script>
