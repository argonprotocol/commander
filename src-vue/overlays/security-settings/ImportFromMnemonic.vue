<!-- prettier-ignore -->
<template>
  <div class="flex flex-col px-3">
    <p class="text-md text-slate-500">
      All your data in this Argon Commander app can be entirely recreated from a single account recovery file. Click
      the button below to download. And keep it safe! It contains your account's private key, so don't share it with anyone.
    </p>

    <!-- Alert for word count validation -->
    <div v-if="wordCountError" class="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
      <p class="text-red-700 text-sm">
        {{ wordCountError }}
      </p>
    </div>
  
    <ol class="grid grid-cols-3 gap-y-2 gap-x-5 pr-3 mt-5 mb-6 ml-1">
      <li v-for="i in 12" :key="i" class="flex flex-row items-center gap-2 py-1">
        <span class="text-slate-500 font-mono text-md">{{ `${i}.`.padStart(3, '&nbsp;') }}</span>
        <input 
          type="text" 
          :class="[hasErrors && !mnemonic[i - 1] ? 'border-red-600 outline-2 outline-red-500/30' : 'border-slate-300']" 
          class="w-full border rounded-md p-2" 
          v-model="mnemonic[i - 1]"
          @paste="handlePaste"
          @input="validateMnemonic"
        />
      </li>
    </ol>

    <button class="bg-argon-600 text-white rounded-md py-2 px-3 mb-1 cursor-pointer" @click="importAccount">
      Import Account
    </button>
    
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useConfig } from '../../stores/config';
import { useController } from '../../stores/controller';

const config = useConfig();
const controller = useController();

const mnemonic = Vue.ref(['', '', '', '', '', '', '', '', '', '', '', '']);
const wordCountError = Vue.ref('');
const hasErrors = Vue.ref(false);
const isSavingExport = Vue.ref(false);
const hasSavedExport = Vue.ref(false);

const emit = defineEmits(['close', 'goto']);

function goto(screen: 'import-from-mnemonic') {
  emit('goto', screen);
}

function handlePaste(event: ClipboardEvent) {
  event.preventDefault();

  const pastedText = event.clipboardData?.getData('text') || '';
  const words = pastedText
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0);

  if (words.length === 0) return;

  if (words.length !== 12) {
    wordCountError.value = `Please paste exactly 12 words. You pasted ${words.length} word${words.length === 1 ? '' : 's'}.`;
    return;
  }

  // Clear error and populate mnemonic array
  wordCountError.value = '';
  mnemonic.value = words;
}

function validateMnemonic() {
  // Clear error when user manually types
  wordCountError.value = '';

  // Check if all fields are filled
  const filledWords = mnemonic.value.filter(word => word.trim().length > 0);

  if (filledWords.length > 0 && filledWords.length !== 12) {
    wordCountError.value = `Please enter exactly 12 words. You have ${filledWords.length} word${filledWords.length === 1 ? '' : 's'}.`;
  }
}

async function importAccount() {
  hasErrors.value = mnemonic.value.some(word => !word);
  console.log(hasErrors.value);
  if (hasErrors.value) return;
}
</script>
