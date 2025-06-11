<template>
  <div class="flex flex-col h-full w-full cursor-default">
    <AlertBars />

    <FirstAuctionStarting />
    <!-- <FirstAuctionWinning /> -->
    <!-- <FirstAuctionFailed /> -->
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import AlertBars from '../../components/AlertBars.vue';
import FirstAuctionStarting from './FirstAuctionStarting.vue';
import FirstAuctionWinning from './FirstAuctionWinning.vue';
import FirstAuctionFailed from './FirstAuctionFailed.vue';
</script>
