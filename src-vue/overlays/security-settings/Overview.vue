<!-- prettier-ignore -->
<template>
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
