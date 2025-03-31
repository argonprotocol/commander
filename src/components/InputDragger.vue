<template>
  <component :is="as" ref="$el" InputDragger class="cursor-ew-resize select-none" @pointerdown="onPointerDown" @pointerup="onPointerUp">
    <slot></slot>
  </component>
</template>

<script setup lang="ts">
import * as Vue from 'vue';

const props = withDefaults(defineProps<{
  input: number;
  min: number,
  max: number,
  minChange?: number,
  reversed?: boolean,
  as?: string
}>(), {
  as: 'span',
  reversed: false,
  minChange: 0.01
});

const emit = defineEmits<{
  (e: 'change', value: number): void
}>();

const $el = Vue.ref<HTMLElement | null>(null);
const dragRange = 500;

let startDragX: number | null = null;
let startValue: number = props.input;

function onPointerDown(event: PointerEvent) {
  const elem = $el.value;
  if (!elem) return;

  elem.onpointermove = emitDrag;
  elem.setPointerCapture(event.pointerId);
  startDragX = event.clientX;
  startValue = props.input;
}

function emitDrag(event: PointerEvent) {
  if (startDragX === null) return;

  const currentX = event.clientX;
  
  let deltaX = currentX - startDragX;
  let changeBy = 0;

  if (props.reversed) {
    deltaX = -deltaX;
  }

  // Calculate the absolute drag distance and cap it at 1000px
  const absDeltaX = Math.min(Math.abs(deltaX), dragRange);
  
  // Create an exponential curve for the change multiplier
  // At the start it will be close to minChange
  // As you drag further, it will approach the full range
  const dragProgress = absDeltaX / dragRange;
  const exponentialFactor = Math.pow(dragProgress, 2); // Square for more gradual initial control
  
  // Use the total range instead of relative ranges
  const totalRange = props.max - props.min;
  const scaledChange = props.minChange + (totalRange * 0.1 - props.minChange) * exponentialFactor;
  
  changeBy = deltaX > 0 ? scaledChange : -scaledChange;

  if (deltaX > 0 && !props.reversed || deltaX < 0 && props.reversed) {
    document.body.classList.add('isDraggingIncrease');
    document.body.classList.remove('isDraggingDecrease');
  } else {
    document.body.classList.add('isDraggingDecrease');
    document.body.classList.remove('isDraggingIncrease');
  }

  // Calculate decimal precision based on minChange
  const precision = Math.max(0, -Math.floor(Math.log10(props.minChange)));
  const multiplier = Math.pow(10, precision);
  
  // Round to the appropriate decimal places
  let value = Math.round((startValue + changeBy) * multiplier) / multiplier;
  
  if (value < props.min) value = props.min;
  else if (value > props.max) value = props.max;

  emit('change', value);
}

function onPointerUp(event: PointerEvent) {
  const elem = $el.value;
  if (!elem) return;

  elem.onpointermove = null;
  elem.releasePointerCapture(event.pointerId);
  document.body.classList.remove('isDraggingIncrease');
  document.body.classList.remove('isDraggingDecrease');
}
</script>