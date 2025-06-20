<template>
  <div class="Component ProgressBar" :hasError="props.hasError">
    <div Bar :style="{ width: `calc(${progress}% + 2px)` }">
      <span v-if="hasError">ERROR</span>
      <span v-else :style="{ opacity: progress / 25 }">{{ progressLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';

const props = defineProps<{
  progress: number;
  isSlow?: boolean;
  hasError?: boolean;
}>();

const progressLabel = Vue.computed(() => {
  if (props.progress < 99 && !props.isSlow) {
    return `${props.progress.toFixed(1)}%`;
  } else if (props.progress < 99.99) {
    return `${props.progress.toFixed(2)}%`;
  } else if (props.progress < 100) {
    return '99.99%';
  } else {
    return '100%';
  }
});
</script>

<style>
@reference "../main.css";

.Component.ProgressBar {
  @apply w-full h-8 bg-[#F2EAF3] rounded border relative;
  border-color: rgba(0, 0, 0, 0.15);
  box-shadow: inset 1px 1px 3px rgba(0, 0, 0, 0.15);
  div[Bar] {
    @apply flex items-center justify-end bg-white rounded border overflow-hidden transition-[width] duration-[1.2s];
    border-color: rgba(0, 0, 0, 0.3);
    height: calc(100% + 2px);
    position: absolute;
    left: -1px;
    top: -1px;
    &:after {
      content: '';
      position: absolute;
      left: 0;
      top: 1px;
      bottom: 1px;
      width: 20px;
      max-width: 100%;
      background: linear-gradient(to right, white 10%, transparent 100%);
    }
  }
  &[hasError='true'] {
    div[Bar] {
      @apply bg-[#FAD1D8];
      opacity: 0.7;
      width: calc(100% + 1px) !important;
      box-shadow: inset 1px 1px 0 white !important;
      &:after {
        background: linear-gradient(to right, #fad1d8 10%, transparent 100%);
        left: 1px;
      }
    }
  }
  span {
    @apply text-xs text-gray-500 pr-2;
  }
}
</style>
