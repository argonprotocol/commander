<template>
  <div
    v-if="isOpen"
    :style="{ top: top, left: left, transform: `translate(${translateX}, ${translateY})`, width: width }"
    class="absolute z-[1200] border border-gray-800/20 flex flex-col rounded-md bg-white px-4 py-3 text-left shadow-xl transition-all pointer-events-none"
  >
    <div
      :style="{
        top: arrowTop,
        bottom: arrowBottom,
        left: arrowLeft,
        right: arrowRight,
        rotate: arrowRotate,
        transform: `translate(${arrowTranslateX}, ${arrowTranslateY})`,
      }"
      class="absolute"
    >
      <svg
        class="relative z-10"
        width="24"
        height="12"
        viewBox="0 0 24 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 0L24 12H0L12 0Z" fill="white" />
      </svg>
      <svg
        class="absolute z-0 -top-0.5 left-[-1px] opacity-10"
        width="26"
        height="14"
        viewBox="0 0 24 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 0L24 12H0L12 0Z" fill="black" />
      </svg>
    </div>

    <div class="grow">
      <div :class="[width ? '' : 'whitespace-nowrap']" class="py-1 text-left text-md text-slate-700 font-light">
        {{ label }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import dayjs from 'dayjs';
import dayjsUtc from 'dayjs/plugin/utc';
import emitter from '../emitters/basic';

dayjs.extend(dayjsUtc);

const isOpen = Vue.ref(false);

const id = Vue.ref('');

const width = Vue.ref('');

const left = Vue.ref('auto');
const top = Vue.ref('auto');
const translateY = Vue.ref('0');
const translateX = Vue.ref('0');

const arrowLeft = Vue.ref('auto');
const arrowRight = Vue.ref('auto');
const arrowTop = Vue.ref('auto');
const arrowBottom = Vue.ref('auto');
const arrowRotate = Vue.ref('0deg');
const arrowTranslateY = Vue.ref('0');
const arrowTranslateX = Vue.ref('0');

const label = Vue.ref('');

emitter.on('showTooltip', (incoming: any) => {
  isOpen.value = true;
  label.value = incoming.label;

  if (incoming.width == 'parent') {
    const parentWidth = incoming.parentWidth + (incoming.widthPlus || 0);
    width.value = `${parentWidth}px`;
  } else {
    width.value = incoming.width || 'auto';
  }

  if (incoming.verticalPosition === 'above') {
    top.value = `${incoming.parentTop - 8}px`;
    translateY.value = '-100%';
    arrowTop.value = 'auto';
    arrowBottom.value = '0px';
    arrowTranslateY.value = '-100%';
    arrowRotate.value = '180deg';
  } else {
    top.value = `${incoming.parentTop + incoming.parentHeight + 7}px`;
    translateY.value = '0';
    arrowTop.value = '0px';
    arrowBottom.value = 'auto';
    arrowTranslateY.value = '-100%';
    arrowRotate.value = '0deg';
  }

  if (incoming.horizontalPosition === 'center') {
    left.value = `${incoming.parentLeft + incoming.parentWidth / 2}px`;
    translateX.value = '-50%';
    arrowLeft.value = '50%';
    arrowRight.value = 'auto';
    arrowTranslateX.value = '50%';
  }
});

emitter.on('hideTooltip', () => {
  isOpen.value = false;
});
</script>
