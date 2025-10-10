<template>
  <Chart ref="chartRef" />
  <NibSlider
    ref="nibSliderRef"
    position="right"
    :pos="sliderLeftPosX"
    :isActive="false"
    @pointerdown="startDrag($event)"
    @pointermove="onDrag($event)"
    @pointerup="stopDrag($event)" />
</template>

<script lang="ts">
export interface IChartItem {
  date: string;
  score: number;
  isFiller: boolean;
  previous: IChartItem | undefined;
  next: IChartItem | undefined;
}
</script>

<script setup lang="ts">
import * as Vue from 'vue';
import Chart from './Chart.vue';
import NibSlider from './NibSlider.vue';

const props = defineProps<{
  chartItems: IChartItem[];
}>();

const emit = defineEmits<{
  (e: 'changedFrame', index: number): void;
}>();

let dragMeta: any = {};

const chartRef = Vue.ref<InstanceType<typeof Chart> | null>(null);
const nibSliderRef = Vue.ref<InstanceType<typeof NibSlider> | null>(null);

const isDragging = Vue.ref(false);

const sliderFrameIndex = Vue.ref(0);

const sliderLeftPosX = Vue.ref(0);

async function goToPrevFrame() {
  const newFrameIndex = Math.max(sliderFrameIndex.value - 1, 0);
  updateFrameSliderPos(newFrameIndex);
}

async function goToNextFrame() {
  const newFrameIndex = Math.min(sliderFrameIndex.value + 1, props.chartItems.length - 1);
  updateFrameSliderPos(newFrameIndex);
}

function startDrag(event: PointerEvent) {
  const elementLeftPos = sliderLeftPosX.value; // TODO: This is not correct
  const cursor = window.getComputedStyle(event.target as Element).cursor;
  const startX = event.clientX;

  isDragging.value = true;
  dragMeta = {
    startX,
    elemOffset: elementLeftPos - startX,
    elemLeftPos: elementLeftPos,
    startIndex: sliderFrameIndex.value,
    hasShiftKey: event.metaKey || event.shiftKey,
  };

  if (cursor === 'grab') {
    document.body.classList.add('isGrabbing');
  } else if (cursor === 'col-resize') {
    document.body.classList.add('isResizing');
  }
}

function onDrag(event: PointerEvent) {
  if (!isDragging.value) return;

  const rawX = event.clientX;
  const currentX = rawX + dragMeta.elemOffset;
  const currentIndex = chartRef.value?.getItemIndexFromEvent(event, { x: currentX });

  dragMeta.wasDragged = dragMeta.wasDragged || currentIndex !== dragMeta.startIndex;

  updateFrameSliderPos(currentIndex || 0);
}

function stopDrag(event: PointerEvent) {
  isDragging.value = false;

  const rawX = event.clientX;
  const currentX = rawX + dragMeta.elemOffset;
  const currentIndex = chartRef.value?.getItemIndexFromEvent(event, { x: currentX });

  updateFrameSliderPos(currentIndex || 0);

  document.body.classList.remove('isGrabbing');
  document.body.classList.remove('isResizing');
}

let isUserNavigatingHistory = false;

function updateFrameSliderPos(index: number, isUserAction = true) {
  if (isUserNavigatingHistory && !isUserAction) return;
  index = Math.max(index || 0, 0);
  sliderFrameIndex.value = index;
  // if back to latest frame, reset user chosen pos
  isUserNavigatingHistory = index < props.chartItems.length - 1;

  const item = props.chartItems[index];
  if (!item) return;

  const pointPosition = chartRef.value?.getPointPosition(index);
  sliderLeftPosX.value = pointPosition?.x || 0;

  emit('changedFrame', index);
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const action = e.key === 'ArrowRight' ? goToNextFrame : goToPrevFrame;
    action();
  }
}

Vue.watch(
  () => props.chartItems,
  (newItems, oldItems) => {
    chartRef.value?.reloadData(newItems);
    if (newItems.length && !oldItems.length) {
      updateFrameSliderPos(newItems.length - 1, false);
    }
  },
);

Vue.onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);

  Vue.onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
});

defineExpose({
  goToPrevFrame,
  goToNextFrame,
});
</script>
