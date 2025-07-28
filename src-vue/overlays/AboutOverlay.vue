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
            ref="modalRef"
            @mousedown="draggable.onMouseDown($event, modalRef)"
            :initial="{ opacity: 0 }"
            :animate="{ opacity: 1 }"
            :exit="{ opacity: 0 }"
            :style="{
              top: `calc(50% + ${draggable.modalPosition.y}px)`,
              left: `calc(50% + ${draggable.modalPosition.x}px)`,
              transform: 'translate(-50%, -50%)',
              cursor: draggable.isDragging ? 'grabbing' : 'default',
            }"
            class="absolute z-50 bg-white text-md border border-black/40 px-4 pt-6 pb-4 rounded-lg text-center shadow-xl w-80 overflow-scroll cursor-default"
            >
            <img src="/app-icon.png" class="w-14 h-14 rounded-lg mx-auto" />
            <div class="font-bold mt-4">Argon Commander</div>
            <div class="flex flex-col gap-2 border-y border-black/10 py-4 mt-4">
              <div>Version: {{ config.version }}</div>
              <div>OS: {{ platformName }} {{ platformVersion }}</div>
            </div>
            <div class="flex justify-center gap-2 mt-4">
              <button @click="closeOverlay" class="w-1/2 bg-slate-600/20 text-black px-4 py-1 rounded-lg">Okay</button>
              <button @click="copyDetails" class="w-1/2 bg-slate-600/20 text-black px-4 py-1 rounded-lg">Copy</button>
            </div>
            <div class="mt-4 italic text-black/50">
              Open source. Zero rights reserved.
            </div>
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
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle, DialogClose } from 'reka-ui';
import { AnimatePresence, Motion } from 'motion-v';
import { useConfig } from '../stores/config';
import Draggable from './helpers/Draggable';
import { platformName, platformVersion } from '../tauri-controls/utils/os';

const config = useConfig();

const isOpen = Vue.ref(false);
const modalRef = Vue.ref<{ $el: HTMLElement } | null>(null);
const draggable = Vue.reactive(new Draggable());

basicEmitter.on('openAboutOverlay', async (data: any) => {
  isOpen.value = true;
  draggable.modalPosition = { x: 0, y: 0 };
});

function closeOverlay() {
  isOpen.value = false;
}

function copyDetails() {
  const details = `Version: ${config.version}\nOS: ${platformName} ${platformVersion}`;
  navigator.clipboard.writeText(details);
}
</script>
