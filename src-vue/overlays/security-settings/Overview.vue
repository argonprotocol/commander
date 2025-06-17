<template>
  <h2
    class="flex flex-row justify-between items-center text-2xl font-bold text-slate-800/70 border-b border-slate-300 pb-4 mb-5 px-3"
  >
    <div class="grow">Security Settings</div>
    <div
      @click="closeOverlay"
      class="z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/60 hover:bg-[#f1f3f7]"
    >
      <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
    </div>
  </h2>

  <ul class="flex flex-col gap-2 px-3">
    <li
      @click="goto('mnemonics')"
      class="group flex flex-row items-center cursor-pointer hover:text-argon-600 hover:bg-gradient-to-r hover:from-transparent hover:to-argon-menu-hover/70 rounded-md py-4"
    >
      <PasswordIcon class="w-5 h-5 mr-2 opacity-70 group-hover:text-argon-600" />
      View Wallet Recovery Mnemonic
    </li>
    <li
      @click="goto('encrypt')"
      class="group flex flex-row items-center cursor-pointer hover:text-argon-600 hover:bg-gradient-to-r hover:from-transparent hover:to-argon-menu-hover/70 rounded-md py-4"
    >
      <MnemonicsIcon class="w-5 h-5 mr-2 opacity-70 group-hover:text-argon-600" />
      Set Encryption Passphrase
    </li>
  </ul>
</template>

<script setup lang="ts">
import { XMarkIcon } from '@heroicons/vue/24/outline';
import MnemonicsIcon from '../../assets/mnemonics.svg?component';
import PasswordIcon from '../../assets/password.svg?component';

const emit = defineEmits(['close', 'goto']);

function closeOverlay() {
  emit('close');
}

function goto(screen: 'encrypt' | 'mnemonics') {
  emit('goto', screen);
}
</script>
