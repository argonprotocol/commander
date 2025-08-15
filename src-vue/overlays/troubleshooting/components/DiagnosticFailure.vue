<template>
  <div
    v-if="isFailure"
    class="diagnostic-step-failure text-slate-800/50 font-md font-light pr-10 mt-1 select-auto cursor-text"
  >
    <slot :error="error" />
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';

const error = Vue.inject('diagnosticError') as Vue.Ref<Error | null>;
const isFailure = Vue.inject('diagnosticIsFailure') as Vue.Ref<boolean>;
</script>
