<template>
  <ul>
    <Popover>
      <PopoverButton as="li" class="flex flex-row justify-between items-center w-full border-t border-black/10 pb-5 cursor-pointer hover:bg-slate-200/30 py-4 px-2">
        <div class="flex flex-row justify-between items-center pr-6">
          <ArgnToken class="w-16" />
        </div>
        <div class="flex flex-col justify-between items-start grow">
          <div class="text-xl font-bold">Argon</div>
          <div class="">{{addCommas(argonBalance)}} ARGN</div>
        </div>
        <div class="flex flex-col justify-between items-end">
          <div class="font-bold">{{currencySymbol}}{{addCommas(argonTo(argonBalance), 2)}}</div>
          <div class="">0.03%</div>
        </div>
      </PopoverButton>
      <transition enter-active-class="transition ease-out duration-200" enter-from-class="opacity-0 translate-y-1" enter-to-class="opacity-100 translate-y-0" leave-active-class="transition ease-in duration-150" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 translate-y-1">
        <PopoverPanel v-slot="{ close }" class="absolute -right-3 z-100 mt-2 flex w-screen max-w-min">
          <div class="flex flex-col p-1 shrink rounded bg-slate-50 text-sm/6 font-semibold text-gray-900 shadow-lg ring-1 ring-gray-900/20 whitespace-nowrap">
            <a @click="navigate('send'); close()" class="flex flex-row justify-between py-1 px-2 !text-gray-900 hover:!text-indigo-600 hover:bg-slate-200/60 cursor-pointer">
              Send
            </a>
            <a @click="navigate('receive'); close()" class="flex flex-row justify-between py-1 px-2 !text-gray-900 hover:!text-indigo-600 hover:bg-slate-200/60 cursor-pointer">
              Receive
            </a>
            <a href="https://app.uniswap.org/explore/tokens/ethereum/0x6a9143639d8b70d50b031ffad55d4cc65ea55155" target="_blank" class="flex flex-row justify-between py-1 px-2 !text-gray-900 hover:!text-indigo-600 hover:bg-slate-200/60 cursor-pointer">
              Open Uniswap Market
            </a>
          </div>
        </PopoverPanel>
      </transition>
    </Popover>
    <Popover>
      <PopoverButton as="li" class="flex flex-row justify-between items-center w-full border-t border-black/10 pb-5 cursor-pointer hover:bg-slate-200/30 py-4 px-2">
        <div class="flex flex-row justify-between items-center pr-6">
          <ArgnotToken class="w-16" />
        </div>
        <div class="flex flex-col justify-between items-start grow">
          <div class="text-xl font-bold">Argonot</div>
          <div class="">{{addCommas(argonotBalance)}} ARGNOT</div>
        </div>
        <div class="flex flex-col justify-between items-end">
          <div class="font-bold">{{currencySymbol}}{{addCommas(argonotTo(argonotBalance), 2)}}</div>
          <div class="">0.03%</div>
        </div>
      </PopoverButton>
      <transition enter-active-class="transition ease-out duration-200" enter-from-class="opacity-0 translate-y-1" enter-to-class="opacity-100 translate-y-0" leave-active-class="transition ease-in duration-150" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 translate-y-1">
        <PopoverPanel v-slot="{ close }" class="absolute -right-3 z-100 mt-2 flex w-screen max-w-min">
          <div class="flex flex-col p-1 shrink rounded bg-slate-50 text-sm/6 font-semibold text-gray-900 shadow-lg ring-1 ring-gray-900/20 whitespace-nowrap">
            <a @click="navigate('send'); close()" class="flex flex-row justify-between py-1 px-2 !text-gray-900 hover:!text-indigo-600 hover:bg-slate-200/60 cursor-pointer">
              Send
            </a>
            <a @click="navigate('receive'); close()" class="flex flex-row justify-between py-1 px-2 !text-gray-900 hover:!text-indigo-600 hover:bg-slate-200/60 cursor-pointer">
              Receive
            </a>
            <a href="https://app.uniswap.org/explore/tokens/ethereum/0x6a9143639d8b70d50b031ffad55d4cc65ea55155" target="_blank" class="flex flex-row justify-between py-1 px-2 !text-gray-900 hover:!text-indigo-600 hover:bg-slate-200/60 cursor-pointer">
              Open Uniswap Market
            </a>
          </div>
        </PopoverPanel>
      </transition>
    </Popover>
  </ul>
</template>

<script setup lang="ts">
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
import { useAccountStore } from '../../stores/account';
import { addCommas } from '../../lib/Utils';
import { storeToRefs } from 'pinia';
import ArgnToken from '../../assets/tokens/argn.svg';
import ArgnotToken from '../../assets/tokens/argnot.svg';

const accountStore = useAccountStore();
const { argonTo, argonotTo } = accountStore;
const { currencySymbol, argonBalance, argonotBalance } = storeToRefs(accountStore);

const emit = defineEmits(['navigate']);

const navigate = (screen: string) => {
  emit('navigate', { screen });
}
</script>