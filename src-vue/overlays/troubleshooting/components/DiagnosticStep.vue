<template>
  <div v-if="isVisible">
    <slot />
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';

const props = defineProps<{
  run: () => Promise<any>;
}>();

const data = Vue.ref<any>({});
const error = Vue.ref<Error | null>(null);
const isSuccess = Vue.ref(false);
const isFailure = Vue.ref(false);
const isVisible = Vue.ref(false);
const isRunning = Vue.ref(false);

let childIsCompletePromise: Promise<void> | null = null;

// Function to register child components
const registerChild = (promise: Promise<void>) => (childIsCompletePromise = promise);
const unregisterChild = () => (childIsCompletePromise = null);

async function run() {
  try {
    isVisible.value = true;
    isRunning.value = true;
    data.value = (await props.run()) || {};
    await childIsCompletePromise;
    isSuccess.value = true;
  } catch (e: any) {
    console.error('Diagnostic step failed', e);
    error.value = e;
    isFailure.value = true;
  }
  isRunning.value = false;
  return isSuccess.value;
}

defineExpose({ run });

// Provide status and error to child components
Vue.provide('diagnosticData', data);
Vue.provide('diagnosticError', error);
Vue.provide('diagnosticIsSuccess', isSuccess);
Vue.provide('diagnosticIsFailure', isFailure);
Vue.provide('diagnosticIsRunning', isRunning);

// Provide registration functions to child components
Vue.provide('registerDiagnosticChild', registerChild);
Vue.provide('unregisterDiagnosticChild', unregisterChild);
</script>
