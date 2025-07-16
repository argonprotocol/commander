<!-- prettier-ignore -->
<template>
  <div class="flex flex-col h-full w-full cursor-default">
    <AlertBars />

    <FirstAuctionFailed v-if="!bot.maxSeatsPossible" />
    <FirstAuctionWinning v-else-if="config.hasMiningBids" />
    <FirstAuctionStarting v-else />
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import AlertBars from '../../components/AlertBars.vue';
import FirstAuctionStarting from './FirstAuctionStarting.vue';
import FirstAuctionWinning from './FirstAuctionWinning.vue';
import FirstAuctionFailed from './FirstAuctionFailed.vue';
import { useStats } from '../../stores/stats';
import { useConfig } from '../../stores/config';
import { useBot } from '../../stores/bot';

const stats = useStats();
const bot = useBot();
const config = useConfig();

Vue.onMounted(() => stats.start());
Vue.onUnmounted(() => stats.stop());
</script>
