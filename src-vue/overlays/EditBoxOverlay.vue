<!-- prettier-ignore -->
<template>
  <div
    ref="modalElem"
    class="absolute bg-white border border-slate-500/60 rounded-md shadow-lg z-100 text-base"
    :style="[positionStyle, { cursor: isDragging ? 'grabbing' : 'default' }]"
  >
    <div class="flex flex-col">
      <div @mousedown="onDragStart" class="text-xl font-bold font-sans text-argon-600/70 mx-2 pt-4 pb-1 text-center border-b border-slate-400/30">
        {{ titles[id as keyof typeof titles] }}
      </div>

      <div class="flex flex-col grow text-md px-5 mt-4">
        <StartingBid v-if="id === 'minimumBid'" @update:data="updateData" ref="editorInstance" />
        <MaximumBid v-else-if="id === 'maximumBid'" @update:data="updateData" ref="editorInstance" />
        <RebiddingStrategy v-else-if="id === 'rebiddingStrategy'" @update:data="updateData" ref="editorInstance" />
        <CapitalAllocation v-else-if="id === 'capitalAllocation'" @update:data="updateData" ref="editorInstance" />
        <ExpectedGrowth v-else-if="id === 'expectedGrowth'" @update:data="updateData" ref="editorInstance" />
        <CloudMachine v-else-if="id === 'cloudMachine'" @update:data="updateData" ref="editorInstance" />
      </div>

      <div v-if="hideSaveButton" class="flex flex-row justify-end pb-3 pr-3 space-x-3 mt-5 mx-2 border-t border-slate-400/50 pt-3">
        <button @click="cancelOverlay" class="text-slate-800/70 border border-slate-400 px-3 rounded-md cursor-pointer">Close</button>
      </div>
      <div v-else class="flex flex-row justify-end pb-3 pr-3 space-x-3 mt-5 mx-2 border-t border-slate-400/50 pt-3">
        <button @click="cancelOverlay" class="text-slate-800/70 border border-slate-400 px-3 rounded-md cursor-pointer">Cancel</button>
        <button @click="saveOverlay" class="text-white bg-argon-button border border-argon-600 px-3 rounded-md cursor-pointer">Save</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import StartingBid from './edit-box/StartingBid.vue';
import MaximumBid from './edit-box/MaximumBid.vue';
import RebiddingStrategy from './edit-box/RebiddingStrategy.vue';
import CapitalAllocation from './edit-box/CapitalAllocation.vue';
import ExpectedGrowth from './edit-box/ExpectedGrowth.vue';
import CloudMachine from './edit-box/CloudMachine.vue';
import { useConfig } from '../stores/config';
import { jsonParseWithBigInts, jsonStringifyWithBigInts } from '@argonprotocol/commander-core';
import { IBiddingRules } from '@argonprotocol/commander-core';

const props = defineProps<{
  id: IEditBoxOverlayType;
  hideSaveButton?: boolean;
  position?: { top?: number; left?: number; width?: number };
}>();

const emit = defineEmits<{
  (e: 'close', id: IEditBoxOverlayType): void;
  (e: 'update:data'): void;
}>();

const editorInstance = Vue.ref<InstanceType<
  | typeof MaximumBid
  | typeof StartingBid
  | typeof RebiddingStrategy
  | typeof CapitalAllocation
  | typeof ExpectedGrowth
  | typeof CloudMachine
> | null>(null);

export type IEditBoxOverlayTypeForMining =
  | 'capitalToCommit'
  | 'maximumBid'
  | 'minimumBid'
  | 'rebiddingStrategy'
  | 'capitalAllocation'
  | 'expectedGrowth'
  | 'cloudMachine';
export type IEditBoxOverlayTypeForVault =
  | 'capitalDistribution'
  | 'securitizationRatio'
  | 'externalProfitSharing'
  | 'btcFlatFee'
  | 'btcVariableFee'
  | 'personalBtc';
export type IEditBoxOverlayType = IEditBoxOverlayTypeForMining | IEditBoxOverlayTypeForVault;

const config = useConfig();

let previousBiddingRules = jsonStringifyWithBigInts(config.biddingRules);
let lastBoundingClientRect: DOMRect | null = null;

const titles = {
  capitalToCommit: 'Capital to Commit',
  maximumBid: 'Maximum Bid',
  minimumBid: 'Starting Bid',
  rebiddingStrategy: 'Rebidding Strategy',
  capitalAllocation: 'Capital Allocation',
  expectedGrowth: 'Expected Growth',
  cloudMachine: 'Cloud Machine',
};

// --- Draggable Modal Logic ---
const hasDragged = Vue.ref(false);
const isDragging = Vue.ref(false);
const dragStart = Vue.ref({ x: 0, y: 0 });
const mouseStart = Vue.ref({ x: 0, y: 0 });
const modalElem = Vue.ref<HTMLElement | null>(null);

// Reactive position that can be mutated during dragging
const currentPosition = Vue.ref({ top: 0, left: 0, width: 0 });

// Initialize position from props
Vue.watchEffect(() => {
  if (props.position) {
    currentPosition.value = calculatePropsPosition();
  }
});

function calculatePropsPosition() {
  return {
    top: (props.position?.top || 0) - 22,
    left: (props.position?.left || 0) - 22,
    width: (props.position?.width || 0) + 44,
  };
}

const positionStyle = Vue.computed(() => {
  return {
    top: `${currentPosition.value.top}px`,
    left: `${currentPosition.value.left}px`,
    width: `${currentPosition.value.width}px`,
  };
});

function updateData() {
  emit('update:data');
}

function cancelOverlay(e?: MouseEvent) {
  if (editorInstance.value && 'beforeCancel' in editorInstance.value) {
    editorInstance.value.beforeCancel();
  }
  config.biddingRules = jsonParseWithBigInts(previousBiddingRules) as IBiddingRules;
  emit('close', props.id);
  e?.preventDefault();
  e?.stopPropagation();
}

function saveOverlay() {
  if (editorInstance.value && 'beforeSave' in editorInstance.value) {
    editorInstance.value.beforeSave();
  }
  emit('close', props.id);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    cancelOverlay();
  }
}

function onDragStart(e: MouseEvent) {
  console.log('drag start');
  isDragging.value = true;
  hasDragged.value = true;
  mouseStart.value = { x: e.clientX, y: e.clientY };
  dragStart.value = { x: currentPosition.value.left, y: currentPosition.value.top };
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
}

function constrainToViewport(x: number, y: number): { x: number; y: number } {
  if (!modalElem.value) return { x, y };

  const rect = modalElem.value.getBoundingClientRect();
  const modalWidth = rect.width;
  const modalHeight = rect.height;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const padding = 10;

  // Constrain the modal to stay within viewport bounds with padding
  const maxX = vw - modalWidth - padding;
  const maxY = vh - modalHeight - padding;

  return {
    x: Math.max(padding, Math.min(maxX, x)),
    y: Math.max(padding, Math.min(maxY, y)),
  };
}

function onDragMove(e: MouseEvent) {
  if (!isDragging.value) return;
  const dx = e.clientX - mouseStart.value.x;
  const dy = e.clientY - mouseStart.value.y;

  let newX = dragStart.value.x + dx;
  let newY = dragStart.value.y + dy;

  const constrained = constrainToViewport(newX, newY);
  currentPosition.value.left = constrained.x;
  currentPosition.value.top = constrained.y;
}

function onDragEnd() {
  isDragging.value = false;
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
}

function handleResize(boundingClientRect: DOMRect) {
  const heightDiff = boundingClientRect.height - (lastBoundingClientRect?.height || 0);
  if (!hasDragged.value && heightDiff < 0) {
    const newTop = currentPosition.value.top + -heightDiff;
    const propsPosition = calculatePropsPosition();
    return {
      x: currentPosition.value.left,
      y: Math.min(newTop, propsPosition.top),
    };
  }
  return constrainToViewport(currentPosition.value.left, currentPosition.value.top);
}

const observer = new ResizeObserver(entries => {
  if (!modalElem.value) return;

  const boundingClientRect = modalElem.value.getBoundingClientRect();
  const constrained = handleResize(boundingClientRect);

  // Update position if it was constrained
  if (constrained.x !== currentPosition.value.left || constrained.y !== currentPosition.value.top) {
    currentPosition.value.left = constrained.x;
    currentPosition.value.top = constrained.y;
  }

  lastBoundingClientRect = boundingClientRect;
});

Vue.onMounted(() => {
  if (modalElem.value) {
    observer.observe(modalElem.value);
  }
});

Vue.onBeforeMount(async () => {
  window.addEventListener('keydown', handleKeydown);
});

Vue.onBeforeUnmount(() => {
  if (observer && modalElem.value) {
    observer.unobserve(modalElem.value);
  }
  window.removeEventListener('keydown', handleKeydown);
});
</script>
