<template>
  <div class="flex flex-col h-full w-full cursor-default">
    <AlertBars />

    <FirstAuctionFailed />
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import AlertBars from '../../components/AlertBars.vue';
import FirstAuctionFailed from './FirstAuctionFailed.vue';

</script>
