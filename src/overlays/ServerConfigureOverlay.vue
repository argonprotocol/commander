<template>
  <TransitionRoot class='absolute inset-0 z-10' :show="isOpen">
    <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
      <BgOverlay @close="closeOverlay" />
    </TransitionChild>

    <div class="absolute inset-0 z-100 overflow-y-auto pt-[1px] flex items-center justify-center pointer-events-none">
      <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" enter-to="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200" leave-from="opacity-100 translate-y-0 sm:scale-100" leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
        <div class="bg-white border border-black/40 px-7 pt-6 pb-4 rounded-lg pointer-events-auto shadow-xl relative w-160 min-h-60 overflow-scroll">
          <h2 class="flex flex-row justify-between items-center text-2xl font-bold text-slate-800/70 border-b border-slate-300 pb-3 mb-6">
            <div class="grow">Configure Your Cloud Machine</div>
            <div @click="closeOverlay" class="z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/60 hover:bg-[#f1f3f7]">
              <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
            </div>
          </h2>

          <p>
            Changing the IP address of your cloud machine will not uninstall or remove mining software running on the previous server. However, we will provision and setup your new server.
          </p>

          <label class="text-sm font-bold text-slate-800/70 mt-6 mb-2 block">Public SSH Key (ensure this is added to your server)</label>
          <CopyToClipboard ref="sshPublicKeyInputWrapper" @click="highlightCopiedContent" :content="serverConnection.sshPublicKey" class="relative mb-3">
            <input type="text" :value="serverConnection.sshPublicKey" class="bg-white py-3 pl-3 pr-8 border border-slate-300 rounded-md w-full pointer-events-none" readonly />
            <div class="absolute right-8 top-1 w-10 bottom-1 bg-gradient-to-r from-transparent to-white pointer-events-auto"></div>
            <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <CopyIcon class="w-4 h-4" />
            </div>
            <template #copied>
              <div class="absolute top-1/2 -right-5 bg-white border border-gray-400/80 text-gray-600 shadow px-6 py-2 flex items-center rounded text-md whitespace-nowrap">
                Copied
              </div>
            </template>
          </CopyToClipboard>

          <label class="text-sm font-bold text-slate-800/70 mt-4 mb-2 block">IP Address</label>
          <div v-if="ipAddressError" class="rounded-md bg-red-200 p-2 mb-2">
            <div class="flex">
              <div class="shrink-0">
                <ExclamationTriangleIcon class="size-5 text-red-400" aria-hidden="true" />
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800">IP Address cannot be left blank</h3>
              </div>
            </div>
          </div>
          <input type="text" v-model="ipAddress" placeholder="Your Server's IP Address" class="w-full border bg-white border-slate-300 rounded-md px-3 py-3" />
          
          <div class="flex flex-row justify-end gap-4 mt-10 border-t border-slate-300 pt-4">
            <button @click="closeOverlay" class="border border-argon-button bg-argon-button/5 inner-button-shadow text-argon-button hover:text-argon-button-hover hover:border-argon-button-hover px-6 py-2 rounded-md cursor-pointer">Cancel</button>
            <button @click="updateServer" class="bg-argon-button border border-argon-button-hover hover:bg-argon-button-hover text-white font-bold inner-button-shadow px-6 py-2 rounded-md cursor-pointer">Update Server</button>
          </div>
        </div>
      </TransitionChild>
    </div>
  </TransitionRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { storeToRefs } from 'pinia';
import { TransitionChild, TransitionRoot } from '@headlessui/vue';
import emitter from '../emitters/basic';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import BgOverlay from '../components/BgOverlay.vue';
import { useConfigStore} from '../stores/config';
import CopyIcon from '../assets/copy.svg';
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import CopyToClipboard from '../components/CopyToClipboard.vue';

const configStore = useConfigStore();
const { serverConnection } = storeToRefs(configStore);

const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);
const isRemoving = Vue.ref(false);

const ipAddress = Vue.computed(() => serverConnection.value.ipAddress);

const ipAddressError = Vue.ref(false);
const serverConnectionError = Vue.ref(false);

const sshPublicKeyInputWrapper = Vue.ref(null);

emitter.on('openServerConfigureOverlay', async (data: any) => {
  isOpen.value = true;
  isLoaded.value = true;
});

const closeOverlay = () => {
  if (isRemoving.value) return;
  isOpen.value = false;
  isLoaded.value = false;
};

async function updateServer() {
  if (isRemoving.value) return;

  isRemoving.value = true;
};

function highlightCopiedContent() {
  const parentWrapper = sshPublicKeyInputWrapper.value as unknown as HTMLElement;
  if (!parentWrapper) return;
  const input = parentWrapper.querySelector('input') as HTMLInputElement;
  input.select();
}
</script>