<template>
  <div class="absolute inset-0 rounded-lg bg-black/20 transition-opacity z-90" data-tauri-drag-region>
    <div class="absolute top-[22px] left-0">
      <WindowControls />
    </div>
    <div v-if="props.allowCurrencyMenu" class="absolute top-[13px] right-[71px]">
      <CurrencyMenu :isDark="true" />
    </div>
    <div>
      <div v-if="hasCloseListener" @click="emitClose" class="absolute top-[13px] right-[16px] flex items-center justify-center text-sm/6 font-semibold text-gray-900 cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 bg-[#D3D5D9] hover:border-slate-500/70 hover:bg-[#D6D9DF]">
        <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import WindowControls from "../tauri-controls/WindowControls.vue";
import CurrencyMenu from './CurrencyMenu.vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  allowCurrencyMenu: {
    type: Boolean,
    default: true,
  },
});

const instance = Vue.getCurrentInstance();
const hasCloseListener = instance?.vnode.props?.onClose !== undefined;

const emit = defineEmits(['close']);

const emitClose = () => {
  emit('close');
};
</script>