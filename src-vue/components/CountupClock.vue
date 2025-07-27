<!-- prettier-ignore -->
<template>
  <component :is="as" :class="$attrs.class">
    <slot :hours="hours" :minutes="minutes" :seconds="seconds" :isNull="isNull"></slot>
  </component>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import dayjs, { type Dayjs } from 'dayjs';

const props = defineProps<{
  time: Dayjs | null;
  as?: string;
}>();

const emit = defineEmits<{
  (
    e: 'update:tick',
    time: {
      totalSecondsElapsed: number;
      hours: number;
      minutes: number;
      seconds: number;
      isNull: boolean;
    },
  ): void;
}>();

const hours = Vue.ref(0);
const minutes = Vue.ref(0);
const seconds = Vue.ref(0);
const isNull = Vue.ref(false);

function updateTime() {
  let totalSecondsElapsed = 0;

  if (props.time) {
    const now = dayjs.utc();
    totalSecondsElapsed = now.diff(props.time, 'seconds');
    hours.value = Math.floor(totalSecondsElapsed / 3600);
    minutes.value = Math.floor((totalSecondsElapsed % 3600) / 60);
    seconds.value = totalSecondsElapsed % 60;
    isNull.value = false;
  } else {
    hours.value = 0;
    minutes.value = 0;
    seconds.value = 0;
    isNull.value = true;
  }
  emit('update:tick', {
    totalSecondsElapsed,
    hours: hours.value,
    minutes: minutes.value,
    seconds: seconds.value,
    isNull: isNull.value,
  });
  setTimeout(updateTime, 1000);
}
Vue.watch(
  () => props.time,
  () => {
    updateTime();
  },
);
Vue.onMounted(updateTime);
</script>
