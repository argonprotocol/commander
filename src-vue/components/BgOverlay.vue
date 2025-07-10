<!-- prettier-ignore -->
<template>
  <div
    @click="emitClose"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    class="absolute inset-0 rounded-lg bg-black/20 transition-opacity"
    data-tauri-drag-region
  >
    <div v-if="showWindowControls" @click.stop class="absolute top-[22px] left-0">
      <WindowControls />
    </div>
  </div>
</template>

<script setup lang="ts">
import WindowControls from '../tauri-controls/WindowControls.vue';

const props = withDefaults(
  defineProps<{
    showWindowControls?: boolean;
  }>(),
  {
    showWindowControls: true,
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
