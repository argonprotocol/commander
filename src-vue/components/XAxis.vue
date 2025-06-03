<template>
  <div class="X-AXIS COMPONENT text-sm text-slate-400 border-t border-slate-300 select-none relative -top-7">
    <ul Dates class="flex flex-row justify-around pt-0.5 text-center whitespace-nowrap mb-1">
      <li v-for="length in lengths" :key="length" class="border-l border-slate-300" :style="`width: ${lengthWidth}%`">{{ getMonthAbbr(length) }}</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

const emit = defineEmits(['phaseenter', 'phaseleave']);

let lengths = 12;
let lengthWidth = 100 / lengths;

function getMonthAbbr(length: number): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[length - 1] || '';
}
</script>

<style lang="scss">
.X-AXIS.COMPONENT {
  li::selection      { 
    color: rgb(148 163 184);
    background: white;
  }
  ul[Dates] li:first-child {
    border-left: none;
  }
}
</style>