<template>
  <slot :hours="hours" :minutes="minutes" :seconds="seconds"></slot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import dayjs, { type Dayjs } from 'dayjs';

const props = defineProps<{
  time: Dayjs;
}>();

const emit = defineEmits<{
  (e: 'update:tick', time: number): void;
}>();

const hours = Vue.ref(0);
const minutes = Vue.ref(0);
const seconds = Vue.ref(0);

function updateTime() {
  const now = dayjs.utc();
  const totalSeconds = props.time.diff(now, 'seconds');
  hours.value = Math.floor(totalSeconds / 3600);
  minutes.value = Math.floor((totalSeconds % 3600) / 60);
  seconds.value = totalSeconds % 60;

  emit('update:tick', totalSeconds);

  if (totalSeconds > 0) {
    setTimeout(updateTime, 1000);
  }
}

Vue.onMounted(updateTime);
</script>
