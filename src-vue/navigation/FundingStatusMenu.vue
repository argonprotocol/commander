<template>
  <HoverCardRoot>
    <HoverCardTrigger>
      <div v-if="wallets.isLoaded">
        <div
          class="flex flex-row items-center gap-x-2 bg-red-500 border border-red-600 text-white px-4 py-0.5 rounded-md"
        >
          <div class="w-4 h-4">
            <StatusSad />
          </div>
          Underfunded
        </div>
      </div>
      <div v-else class="text-gray-900 px-2">Loading...</div>
    </HoverCardTrigger>
    <HoverCardPortal>
      <HoverCardContent>
        <div>
          <div></div>
        </div>
      </HoverCardContent>
    </HoverCardPortal>
  </HoverCardRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { HoverCardArrow, HoverCardContent, HoverCardPortal, HoverCardRoot, HoverCardTrigger } from 'reka-ui';
import { useWallets } from '../stores/wallets';
import StatusSad from '../assets/status-sad.svg';

const wallets = useWallets();
</script>
