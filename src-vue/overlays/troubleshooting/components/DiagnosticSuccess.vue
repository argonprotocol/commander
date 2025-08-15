<template>
  <div
    v-if="isSuccess"
    class="diagnostic-step-success text-slate-800/50 font-md font-light pr-10 mt-1 select-auto cursor-text"
  >
    <slot :data="data" />
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';

const data = Vue.inject('diagnosticData') as Vue.Ref<any>;
const isSuccess = Vue.inject('diagnosticIsSuccess') as Vue.Ref<boolean>;
</script>
