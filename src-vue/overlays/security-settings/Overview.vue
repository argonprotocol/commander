<!-- prettier-ignore -->
<template>
  <ul class="flex flex-col px-3">
    <li
      @click="goto('mnemonics')"
      class="group flex flex-row items-center cursor-pointer hover:text-argon-600 hover:bg-gradient-to-r hover:from-transparent hover:to-argon-menu-hover/70 rounded-md py-4"
    >
      <PasswordIcon class="w-5 h-5 mr-2 opacity-70 group-hover:text-argon-600" />
      View Account Recovery Mnemonic
    </li>
    <li
      @click="goto('ssh')"
      class="group flex flex-row items-center cursor-pointer hover:text-argon-600 hover:bg-gradient-to-r hover:from-transparent hover:to-argon-menu-hover/70 rounded-md py-4"
    >
      <TerminalIcon class="w-5 h-5 mr-2 opacity-70 group-hover:text-argon-600" />
      View SSH Keys for Cloud Machine
    </li>
    <li class="h-[1px] border-t border-slate-300 border-dashed my-4" />
    <li
      @click="goto('encrypt')"
      class="group flex flex-row items-center cursor-pointer hover:text-argon-600 hover:bg-gradient-to-r hover:from-transparent hover:to-argon-menu-hover/70 rounded-md py-4"
    >
      <MnemonicsIcon class="w-5 h-5 mr-2 opacity-70 group-hover:text-argon-600" />
      Set Encryption Passphrase
    </li>
    <li class="h-[1px] border-t border-slate-300 border-dashed my-4" />
    <li
      @click="exportAccount"
      class="group flex flex-row items-center cursor-pointer hover:text-argon-600 hover:bg-gradient-to-r hover:from-transparent hover:to-argon-menu-hover/70 rounded-md py-4"
    >
      <ExportIcon class="w-5 h-5 mr-2 opacity-70 group-hover:text-argon-600" />
      Export Current Account
      <AnimatePresence>
        <Motion
          v-if="isSavingExport"
          :initial="{ opacity: 0.5 }"
          :animate="{ opacity: 1 }"
          :transition="{ repeat: Infinity, duration: 0.5, ease: 'easeInOut', repeatType: 'reverse' }"
          class="text-xs bg-argon-600 text-white rounded-full px-4 py-1 ml-2"
        >
          SAVING
        </Motion>
        <Motion
          v-else-if="hasSavedExport"
          :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }"
          :exit="{ opacity: 0 }"
          :transition="{ duration: 1, ease: 'easeIn' }"
          :exit-transition="{ duration: 1, ease: 'easeOut' }"
          class="text-xs bg-argon-600 text-white rounded-full px-4 py-1 ml-2"
        >
          SAVED
        </Motion>
      </AnimatePresence>
    </li>
    <li
      @click="importAccount"
      class="group flex flex-row items-center cursor-pointer hover:text-argon-600 hover:bg-gradient-to-r hover:from-transparent hover:to-argon-menu-hover/70 rounded-md py-4"
    >
      <ImportIcon class="w-5 h-5 mr-2 opacity-70 group-hover:text-argon-600" />
      Import Account
    </li>
  </ul>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import MnemonicsIcon from '../../assets/mnemonics.svg?component';
import PasswordIcon from '../../assets/password.svg?component';
import TerminalIcon from '../../assets/terminal.svg?component';
import ImportIcon from '../../assets/import.svg?component';
import ExportIcon from '../../assets/export.svg?component';
import { open as openFileOverlay, save as saveFileOverlay } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { useConfig } from '../../stores/config';
import { jsonStringifyWithBigInts, jsonParseWithBigInts } from '@argonprotocol/commander-calculator';
import { AnimatePresence, Motion } from 'motion-v';
import { useController } from '../../stores/controller';

const emit = defineEmits(['close', 'goto']);

const config = useConfig();
const controller = useController();

const isSavingExport = Vue.ref(false);
const hasSavedExport = Vue.ref(false);

function goto(screen: 'encrypt' | 'mnemonics' | 'ssh' | 'import' | 'export') {
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

async function exportAccount() {
  const filePath = await saveFileOverlay({
    defaultPath: 'argon-commander-recovery.json.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!filePath) return; // user cancelled

  isSavingExport.value = true;
  const data = {
    security: config.security,
    oldestFrameIdToSync: config.oldestFrameIdToSync,
    biddingRules: config.biddingRules,
    vaultingRules: config.vaultingRules,
    defaultCurrencyKey: config.defaultCurrencyKey,
    requiresPassword: config.requiresPassword,
    serverDetails: config.serverDetails,
    userJurisdiction: config.userJurisdiction,
  };
  const pretty = jsonStringifyWithBigInts(data, null, 2);
  await writeTextFile(filePath, pretty);
  isSavingExport.value = false;
  hasSavedExport.value = true;
  setTimeout(() => {
    hasSavedExport.value = false;
  }, 5_000);
}
</script>
