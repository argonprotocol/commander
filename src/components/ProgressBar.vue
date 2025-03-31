<template>
  <div class="Component ProgressBar">
    <div :style="{ width: `calc(${progress}% + 2px)` }">
      <span :style="{ opacity: progress / 25 }">{{ progressLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';

const props = defineProps<{
  progress: number;
  isSlow?: boolean;
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
  @apply w-full h-7 bg-[#F2EAF3] rounded border relative;
  border-color: rgba(0, 0, 0, 0.15);
  box-shadow: inset 1px 1px 3px rgba(0, 0, 0, 0.15);
  div {
    @apply flex items-center justify-end bg-white rounded border overflow-hidden;
    border-color: rgba(0, 0, 0, 0.3);
    height: calc(100% + 2px);
    position: absolute;
    left: -1px;
    top: -1px
  }
  span {
    @apply text-xs text-gray-500 pr-2;
  }
}
</style>