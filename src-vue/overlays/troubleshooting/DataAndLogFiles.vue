<template>
  <ul class="pt-2 pb-5 px-4 space-y-4">
    <li>
      <header>Local Data</header>
      <p>Most of your locally cached data is stored in a sqlite database, which located in the following directory:</p>
      <div class="relative mt-2">
        <input
          v-model="localDataDir"
          disabled
          class="font-mono border border-black/20 rounded-md p-1 text-md pr-32 w-full overflow-x-scroll whitespace-nowrap"
        />
        <div
          class="absolute right-1 top-1 bottom-1 pr-2 pl-10 flex items-center bg-gradient-to-r from-transparent from-0% via-white via-20% to-white"
        >
          <a @click="openDataDir" class="!text-argon-500 cursor-pointer">Open Directory</a>
        </div>
      </div>
    </li>
    <li>
      <header>Local Logs</header>
      <p>All output from your app's runtime logs are stored in the following directory:</p>
      <div class="relative mt-2">
        <input
          v-model="localLogDir"
          disabled
          class="font-mono border border-black/20 rounded-md p-1 text-md pr-32 w-full overflow-x-scroll whitespace-nowrap"
        />
        <div
          class="absolute right-1 top-1 bottom-1 pr-2 pl-10 flex items-center bg-gradient-to-r from-transparent from-0% via-white via-20% to-white"
        >
          <a @click="openLogDir" class="!text-argon-500 cursor-pointer">Open Directory</a>
        </div>
      </div>
    </li>
    <li>
      <header>Remote Logs</header>
      <p>Remote logs from your server accrue in the following directory on your cloud machine:</p>
      <input
        v-model="remoteLogDir"
        disabled
        class="mt-2 font-mono border border-black/20 rounded-md p-1 text-md w-full overflow-x-scroll whitespace-nowrap"
      />
    </li>
  </ul>
  <!-- <div class="flex my-3 mx-4 border-t border-black/20 pt-3">
    <button @click="createZipFile" class="bg-argon-600 text-white rounded-md py-2 px-3">Compile All Data Into a Single Zip File</button>
  </div> -->
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { Db } from '../../lib/Db';
import { appLogDir, appDataDir } from '@tauri-apps/api/path';
import { openPath } from '@tauri-apps/plugin-opener';

const localDataDir = Vue.ref('');
const localLogDir = Vue.ref('');
const remoteLogDir = Vue.ref('~/logs');

async function openLogDir() {
  await openPath(localLogDir.value);
}

async function openDataDir() {
  await openPath(localDataDir.value);
}

async function createZipFile() {
  // TODO: Create zip file
}

Vue.onMounted(async () => {
  const dataDir = await appDataDir();
  localDataDir.value = `${dataDir}/${Db.relativeDir}`;
  localLogDir.value = await appLogDir();
});
</script>

<style scoped>
@reference "../../main.css";

header {
  @apply font-bold text-lg;
}
</style>
