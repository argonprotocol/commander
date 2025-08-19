<!-- prettier-ignore -->
<template>
  <div class="flex flex-col px-3">
    <p class="text-md text-slate-500">
      All your data in this Argon Commander app can be entirely recreated from a single account recovery file. Click
      the button below to download. And keep it safe! It contains your account's private key, so don't share it with anyone.
    </p>

    <ul class="flex flex-row items-center w-full text-center space-x-2 font-bold mt-4">
      <li @click="importAccount" class="flex flex-col w-1/2 items-center cursor-pointer py-6 hover:bg-slate-100 rounded-md">
        <RecoveryFileIcon class="w-14 h-14 inline-block mb-2" />
        Import from Recovery File
      </li>
      <li @click="goto('import-from-mnemonic')" class="flex flex-col w-1/2 items-center cursor-pointer py-6 hover:bg-slate-100 rounded-md">
        <MnemonicsIcon class="w-14 h-14 inline-block mb-2" />
        Import from Mnemonic
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useConfig } from '../../stores/config';
import { open as openFileOverlay } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import RecoveryFileIcon from '../../assets/recovery-file.svg?component';
import MnemonicsIcon from '../../assets/mnemonics.svg?component';
import { useController } from '../../stores/controller';

const config = useConfig();
const isSavingExport = Vue.ref(false);
const hasSavedExport = Vue.ref(false);

const emit = defineEmits(['close', 'goto']);

const controller = useController();

function goto(screen: 'import-from-mnemonic') {
  emit('goto', screen);
}

async function importAccount() {
  const filePath = await openFileOverlay({
    multiple: false,
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
  });
  if (!filePath || Array.isArray(filePath)) return; // cancelled or multi-select

  const dataRaw = await readTextFile(filePath);
  emit('close');
  controller.importAccount(dataRaw);
}
</script>
