<!-- prettier-ignore -->
<template>
  <DialogRoot class="absolute inset-0 z-10" :open="isOpen">
    <DialogPortal>
      <AnimatePresence>
        <DialogOverlay asChild>
          <Motion asChild :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0 }">
            <BgOverlay @close="closeOverlay" />
          </Motion>
        </DialogOverlay>

        <DialogContent asChild @escapeKeyDown="closeOverlay" :aria-describedby="undefined">
          <Motion
            :ref="draggable.setModalRef"
            :initial="{ opacity: 0 }"
            :animate="{ opacity: 1 }"
            :exit="{ opacity: 0 }"
            class="absolute z-50 bg-white border border-black/40 px-3 pt-6 pb-4 rounded-lg shadow-xl min-h-60 overflow-scroll focus:outline-none"
            :style="{
              width: `${overlayWidth}px`,
              top: `calc(50% + ${draggable.modalPosition.y}px)`,
              left: `calc(50% + ${draggable.modalPosition.x}px)`,
              transform: 'translate(-50%, -50%)',
              cursor: draggable.isDragging ? 'grabbing' : 'default',
            }"
          >
            <h2
              :class="[currentScreen === 'overview' ? 'pb-4 mb-5 px-3' : 'pb-3 pl-2 pr-3 mb-5']"
              class="flex flex-row justify-between items-center text-2xl font-bold text-slate-800/70 border-b border-slate-300 select-none"
              @mousedown="draggable.onMouseDown($event)"
            >
              <div v-if="currentScreen !== 'overview'" class="flex flex-row items-center hover:bg-[#f1f3f7] rounded-md p-1 pl-0 mr-2 cursor-pointer">
                <ChevronLeftIcon @click="goBack()" class="w-6 h-6 cursor-pointer relative -top-0.25" />
              </div>
              <DialogTitle class="grow">{{ title }}</DialogTitle>
              <DialogClose
                @click="closeOverlay"
                class="z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/60 hover:bg-[#f1f3f7]"
              >
                <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
              </DialogClose>
            </h2>

            <SecuritySettingsOverview v-if="currentScreen === 'overview'" @close="closeOverlay" @goTo="goTo" />
            <SecuritySettingsMnemonics v-if="currentScreen === 'mnemonics'" @close="closeOverlay" @goTo="goTo" />
            <SecuritySettingsSSHKeys v-if="currentScreen === 'ssh'" @close="closeOverlay" @goTo="goTo" />
            <SecuritySettingsEncrypt v-if="currentScreen === 'encrypt'" @close="closeOverlay" @goTo="goTo" />
            <ExportRecoveryFile v-if="currentScreen === 'export'" @close="closeOverlay" @goTo="goTo" />
            <Import v-if="currentScreen === 'import'" @close="closeOverlay" @goTo="goTo" />
            <ImportFromMnemonic v-if="currentScreen === 'import-from-mnemonic'" @close="closeOverlay" @goTo="goTo" />
          </Motion>
        </DialogContent>
      </AnimatePresence>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import basicEmitter from '../emitters/basicEmitter';
import BgOverlay from '../components/BgOverlay.vue';
import SecuritySettingsOverview from './security-settings/Overview.vue';
import SecuritySettingsEncrypt from './security-settings/Encrypt.vue';
import SecuritySettingsMnemonics from './security-settings/Mnemonics.vue';
import SecuritySettingsSSHKeys from './security-settings/SSHKeys.vue';
import ExportRecoveryFile from './security-settings/ExportRecoveryFile.vue';
import Import from './security-settings/Import.vue';
import ImportFromMnemonic from './security-settings/ImportFromMnemonic.vue';
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, DialogClose } from 'reka-ui';
import { AnimatePresence, Motion } from 'motion-v';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { ChevronLeftIcon } from '@heroicons/vue/24/outline';
import Draggable from './helpers/Draggable.ts';

const isOpen = Vue.ref(false);
const currentScreen = Vue.ref<
  'overview' | 'mnemonics' | 'ssh' | 'encrypt' | 'export' | 'import' | 'import-from-mnemonic'
>('overview');
const overlayWidth = Vue.ref(640);
const draggable = Vue.reactive(new Draggable());

const title = Vue.computed(() => {
  if (currentScreen.value === 'overview') {
    return 'Security and Recovery';
  } else if (currentScreen.value === 'encrypt') {
    return 'Encryption Passphrase';
  } else if (currentScreen.value === 'ssh') {
    return 'SSH Keys for Cloud Machine';
  } else if (currentScreen.value === 'mnemonics') {
    return 'Account Recovery Mnemonic';
  } else if (currentScreen.value === 'export') {
    return 'Export Account Backup File';
  } else if (currentScreen.value === 'import') {
    return 'Import Previous Account';
  } else if (currentScreen.value === 'import-from-mnemonic') {
    return 'Import Previous Account from Mnemonic';
  }
  throw new Error('Invalid screen name');
});

basicEmitter.on('openSecuritySettingsOverlay', async (data: any) => {
  isOpen.value = true;
  currentScreen.value = 'overview';
  draggable.modalPosition.x = 0;
  draggable.modalPosition.y = 0;
});

function closeOverlay() {
  isOpen.value = false;
}

function goBack() {
  if (currentScreen.value === 'import-from-mnemonic') {
    currentScreen.value = 'import';
  } else {
    currentScreen.value = 'overview';
  }
}

function goTo(screen: 'overview' | 'encrypt' | 'mnemonics' | 'ssh' | 'import' | 'export' | 'import-from-mnemonic') {
  currentScreen.value = screen;
  if (screen === 'overview') {
    overlayWidth.value = 640;
  } else if (screen === 'encrypt') {
    overlayWidth.value = 640;
  } else if (screen === 'mnemonics') {
    overlayWidth.value = 740;
  } else if (screen === 'ssh') {
    overlayWidth.value = 740;
  } else if (screen === 'import') {
    overlayWidth.value = 640;
  } else if (screen === 'import-from-mnemonic') {
    overlayWidth.value = 640;
  } else if (screen === 'export') {
    overlayWidth.value = 740;
  }
}
</script>
