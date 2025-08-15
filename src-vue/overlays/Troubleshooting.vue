<!-- prettier-ignore -->
<template>
  <DialogRoot :open="isOpen">
    <DialogPortal>
      <AnimatePresence>
        <DialogOverlay asChild>
          <Motion asChild :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0 }">
            <BgOverlay @close="closeOverlay" />
          </Motion>
        </DialogOverlay>
        
        <DialogContent asChild @escapeKeyDown="handleEscapeKeyDown" :aria-describedby="undefined">
          <Motion asChild :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0 }">
            <div
              :ref="draggable.setModalRef"
              :style="{
                top: `calc(50% + ${draggable.modalPosition.y}px)`,
                left: `calc(50% + ${draggable.modalPosition.x}px)`,
                transform: 'translate(-50%, -50%)',
              }"
              class="absolute z-50 bg-white border border-black/40 p-2 rounded-lg pointer-events-auto shadow-xl w-7/12 max-h-11/12 overflow-scroll focus:outline-none"
            >
              <h2 
                @mousedown="draggable.onMouseDown($event)"
                :class="[activeScreen === 'overview' ? 'pb-3 px-3 mb-2' : 'pb-3 pl-2 pr-3 mb-2']"
                :style="{ cursor: draggable.isDragging ? 'grabbing' : 'grab' }"
                class="flex flex-row items-center w-full pt-3 space-x-4 text-5xl font-bold border-b border-black/20"
              >
                <div v-if="activeScreen !== 'overview'" class="flex flex-row items-center hover:bg-[#f1f3f7] rounded-md p-1 pl-0 mr-2 cursor-pointer">
                  <ChevronLeftIcon @click="goto('overview')" class="w-6 h-6 cursor-pointer relative -top-0.25" />
                </div>
                <DialogTitle v-if="activeScreen === 'overview'" class="text-2xl font-bold grow">Troubleshooting</DialogTitle>
                <DialogTitle v-else-if="activeScreen === 'server-diagnostics'" class="text-2xl font-bold grow">Server Diagnostics</DialogTitle>
                <DialogTitle v-else-if="activeScreen === 'data-and-log-files'" class="text-2xl font-bold grow">Data and Logging</DialogTitle>
                <DialogTitle v-else-if="activeScreen === 'options-for-restart'" class="text-2xl font-bold grow">Advanced Restart</DialogTitle>
                <div @click="closeOverlay" class="mr-1 z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/60 hover:bg-[#f1f3f7]">
                  <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
                </div>
              </h2>
              <div v-if="activeScreen === 'overview'">
                <ul class="flex flex-row items-center w-full text-center space-x-2 font-bold">
                  <li @click="goto('server-diagnostics')" class="flex flex-col w-1/3 items-center cursor-pointer py-10 hover:bg-slate-100 rounded-md">
                    <DiagnosticIcon class="w-14 h-14 inline-block mb-2" />
                    Server Diagnostics
                  </li>
                  <li @click="goto('data-and-log-files')" class="flex flex-col w-1/3 items-center cursor-pointer py-10 hover:bg-slate-100 rounded-md">
                    <LogsIcon class="w-14 h-14 inline-block mb-2" />
                    Data and Logging Files
                  </li>
                  <li @click="goto('options-for-restart')" class="flex flex-col w-1/3 items-center cursor-pointer py-10 hover:bg-slate-100 rounded-md">
                    <RestartIcon class="w-14 h-14 inline-block mb-2" />
                    Advanced Restart
                  </li>
                </ul>
              </div>
              <ServerDiagnostics v-else-if="activeScreen === 'server-diagnostics'" />
              <DataAndLogFiles v-else-if="activeScreen === 'data-and-log-files'" />
              <AdvancedRestart v-else-if="activeScreen === 'options-for-restart'" />
            </div>
          </Motion>
        </DialogContent>
      </AnimatePresence>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import { AnimatePresence, Motion } from 'motion-v';
import basicEmitter from '../emitters/basicEmitter';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import BgOverlay from '../components/BgOverlay.vue';
import Draggable from './helpers/Draggable.ts';
import ServerDiagnostics from './troubleshooting/ServerDiagnostics.vue';
import DataAndLogFiles from './troubleshooting/DataAndLogFiles.vue';
import AdvancedRestart from './troubleshooting/AdvancedRestart.vue';
import { ChevronLeftIcon } from '@heroicons/vue/24/outline';
import DiagnosticIcon from '../assets/diagnostics.svg?component';
import LogsIcon from '../assets/logs.svg?component';
import RestartIcon from '../assets/restart.svg?component';

const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);

const activeScreen = Vue.ref('overview');
const draggable = Vue.reactive(new Draggable());

function goto(screen: 'overview' | 'server-diagnostics' | 'data-and-log-files' | 'options-for-restart') {
  activeScreen.value = screen;
}

basicEmitter.on('openTroubleshootingOverlay', async (data: any) => {
  isOpen.value = true;
  isLoaded.value = true;
  activeScreen.value = data?.screen || 'overview';
});

function closeOverlay() {
  isOpen.value = false;
  isLoaded.value = false;
}

function handleEscapeKeyDown() {
  closeOverlay();
}
</script>
