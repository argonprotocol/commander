<template>
  <div class="flex flex-col h-full text-[#3E444E]">
    <div class="grow m-4 relative">
      <ConfettiIcon class="absolute -top-10 -left-10 w-[calc(100%+80px)] h-[calc(100%+80px)] pointer-events-none" />
      <div
        class="absolute -bottom-2 -left-2 w-[calc(100%+16px)] h-full bg-gradient-to-b from-transparent to-[#F9F2FA] pointer-events-none"
      ></div>

      <div class="relative z-10">
        <h1 class="text-5xl font-bold text-center mt-48">Your Cloud Machine Is Ready!</h1>

        <div class="text-center text-2xl mt-10">
          <template v-if="isClosing">Bidding for The Next Mining Slot Is In the Process of</template>
          <template v-else>Bidding for The Next Mining Slot Closes In</template>
        </div>

        <div v-if="isClosing" isClosing class="text-center text-9xl mt-10 font-bold text-slate-700/70">CLOSING</div>
        <VueCountdown v-else CountdownClock :time="millisecondsUntilEnd" v-slot="{ hours, minutes, seconds }">
          <div class="flex flex-row justify-center py-4 md:py-10 px-2 md:px-8">
            <ul class="flex flex-col items-center">
              <li>{{ hours }}</li>
              <li>HOURS</li>
            </ul>
            <div>:</div>
            <ul class="flex flex-col items-center">
              <li>{{ minutes }}</li>
              <li>MINUTES</li>
            </ul>
            <div>:</div>
            <ul class="flex flex-col items-center">
              <li>{{ seconds }}</li>
              <li>SECONDS</li>
            </ul>
          </div>
        </VueCountdown>

        <button
          @click="openBidderDialog"
          class="bg-[#A600D4] text-2xl font-bold text-white px-10 py-2 rounded-md mx-auto block mt-10 cursor-pointer"
        >
          Open Bidding Panel
        </button>
        <div class="text-center mt-4">(you have not submitted a bid)</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import ConfettiIcon from '../assets/confetti.svg?component';
import VueCountdown from '@chenfengyuan/vue-countdown';
import emitter from '../../emitters/basic';

dayjs.extend(utc);

const isClosing = Vue.ref(false);

let endTime = dayjs.utc().set('hour', 17).set('minute', 0).set('second', 0).set('millisecond', 0);
if (dayjs.utc().hour() < 17) {
  const startsClosingTime = dayjs.utc().set('hour', 16).set('minute', 40).set('second', 0).set('millisecond', 0);
  isClosing.value = dayjs.utc().isAfter(startsClosingTime);
} else {
  endTime = endTime.add(1, 'day');
}
const millisecondsUntilEnd = endTime.valueOf() - dayjs.utc().valueOf();

function openBidderDialog() {
  emitter.emit('openBidderDialog');
}
</script>

<style scoped>
@reference "../../main.css";

[CountdownClock] {
  color: #3e444e;
  div > div {
    @apply text-xl md:text-8xl font-normal opacity-50 md:-mt-2;
  }
  ul {
    @apply px-14;
  }
  ul li:first-child {
    @apply text-3xl md:text-8xl font-bold;
  }
  ul li:last-child {
    @apply text-sm md:text-xl font-light;
  }
}

@keyframes pulseEffect {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.95);
  }
}

[isClosing] {
  animation: pulseEffect 1.5s ease-in-out infinite;
}
</style>
