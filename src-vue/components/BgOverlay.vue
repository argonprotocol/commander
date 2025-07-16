<!-- prettier-ignore -->
<template>
  <div v-if="enableTopBar" class="absolute top-0 left-0 w-full h-14 rounded-t-lg pointer-events-none bg-black/20 transition-opacity"></div>
  <div
    @click="emitClose"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    class="absolute bg-black/20 transition-opacity pointer-events-auto"
    :class="[enableTopBar ? 'top-14 bottom-0 inset-x-0 rounded-b-lg' : 'inset-0 rounded-lg']"
    data-tauri-drag-region
  >
    <div v-if="showWindowControls && !enableTopBar" @click.stop class="absolute top-[22px] left-0">
      <WindowControls />
    </div>
  </div>
</template>

<script setup lang="ts">
import WindowControls from '../tauri-controls/WindowControls.vue';

const props = withDefaults(
  defineProps<{
    showWindowControls?: boolean;
    enableTopBar?: boolean;
  }>(),
  {
    showWindowControls: true,
    enableTopBar: false,
  },
);

const emit = defineEmits(['close']);
const DRAG_THRESHOLD = 5;

let dragStartX = 0;
let dragStartY = 0;
let wasDragged = false;

function emitClose(e: MouseEvent) {
  if (wasDragged) {
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  emit('close');
}

function handlePointerDown(e: PointerEvent) {
  dragStartX = e.screenX;
  dragStartY = e.screenY;
  wasDragged = false;
}

function handlePointerMove(e: PointerEvent) {
  if (Math.abs(e.screenX - dragStartX) > DRAG_THRESHOLD || Math.abs(e.screenY - dragStartY) > DRAG_THRESHOLD) {
    wasDragged = true;
  }
}
</script>
