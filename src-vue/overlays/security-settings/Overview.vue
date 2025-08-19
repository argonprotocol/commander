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
      <EncryptionFileIcon class="w-5 h-5 mr-2 opacity-70 group-hover:text-argon-600" />
      Set Encryption Passphrase
    </li>
    <li class="h-[1px] border-t border-slate-300 border-dashed my-4" />
    <li
      @click="goto('export')"
      class="group flex flex-row items-center cursor-pointer hover:text-argon-600 hover:bg-gradient-to-r hover:from-transparent hover:to-argon-menu-hover/70 rounded-md py-4"
    >
      <ExportIcon class="w-5 h-5 mr-2 opacity-70 group-hover:text-argon-600" />
      Export Account Backup File
    </li>
    <li
      @click="goto('import')"
      class="group flex flex-row items-center cursor-pointer hover:text-argon-600 hover:bg-gradient-to-r hover:from-transparent hover:to-argon-menu-hover/70 rounded-md py-4"
    >
      <ImportIcon class="w-5 h-5 mr-2 opacity-70 group-hover:text-argon-600" />
      Import Previous Account
    </li>
  </ul>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import EncryptionFileIcon from '../../assets/encryption-file.svg?component';
import PasswordIcon from '../../assets/password.svg?component';
import TerminalIcon from '../../assets/terminal.svg?component';
import ImportIcon from '../../assets/import.svg?component';
import ExportIcon from '../../assets/export.svg?component';

const emit = defineEmits(['close', 'goto']);

function goto(screen: 'encrypt' | 'mnemonics' | 'ssh' | 'import' | 'export') {
  emit('goto', screen);
}
</script>
