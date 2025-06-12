<template>
  <ul>
    <Menu
      as="div"
      class="relative"
      v-slot="{ open: isOpen }"
      :open="argonPopoverOpen"
      @update:open="argonPopoverOpen = $event"
    >
      <MenuButton
        as="li"
        ref="argonMenuButton"
        @click="setMenuPositioning($event, isOpen, argonMenuButton as any)"
        class="flex flex-row justify-between items-center w-full border-t border-black/10 first:border-black/30 pb-5 cursor-pointer hover:bg-slate-200/30 py-4 px-2"
      >
        <div class="flex flex-row justify-between items-center pr-6">
          <ArgnToken class="w-16" />
        </div>
        <div class="flex flex-col justify-between items-start grow">
          <div class="text-xl font-bold">Argon</div>
          <div class="">{{ fmtCommas(mngWallet.argons) }} ARGN</div>
        </div>
        <div class="flex flex-col justify-between items-end">
          <div class="font-bold">
            {{ currencyStore.currencySymbol }}{{ fmtMoney(argonTo(mngWallet.argons)) }}
          </div>
          <div class="">0.03%</div>
        </div>
      </MenuButton>
      <transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0 translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-1"
      >
        <MenuItems
          as="div"
          v-slot="{ close }"
          :style="menuPositioning"
          class="absolute z-100 flex max-w-min focus:outline-none"
        >
          <div
            class="flex flex-col p-1 shrink rounded bg-slate-50 text-sm/6 font-semibold text-gray-900 shadow-lg ring-1 ring-gray-900/20 whitespace-nowrap"
          >
            <MenuItem
              as="a"
              @click="
                navigate('receive');
                close();
              "
              class="flex flex-row justify-between py-1 px-2 !text-gray-900 hover:!text-indigo-600 hover:bg-slate-200/60 cursor-pointer"
            >
              Receive
            </MenuItem>
            <MenuItem
              as="a"
              @click="
                navigate('send');
                close();
              "
              class="flex flex-row justify-between py-1 px-2 !text-gray-900 hover:!text-indigo-600 hover:bg-slate-200/60 cursor-pointer"
            >
              Send
            </MenuItem>
            <MenuItem
              as="a"
              href="https://app.uniswap.org/explore/tokens/ethereum/0x6a9143639d8b70d50b031ffad55d4cc65ea55155"
              target="_blank"
              class="flex flex-row justify-between py-1 px-2 !text-gray-900 hover:!text-indigo-600 hover:bg-slate-200/60 cursor-pointer"
            >
              Open Uniswap Market
            </MenuItem>
          </div>
        </MenuItems>
      </transition>
    </Menu>
    <Menu
      as="div"
      class="relative"
      v-slot="{ open: isOpen }"
      :open="argonotPopoverOpen"
      @update:open="argonotPopoverOpen = $event"
    >
      <MenuButton
        as="li"
        ref="argonotMenuButton"
        @click="setMenuPositioning($event, isOpen, argonotMenuButton as any)"
        class="flex flex-row justify-between items-center w-full border-t border-black/10 pb-5 cursor-pointer hover:bg-slate-200/30 py-4 px-2"
      >
        <div class="flex flex-row justify-between items-center pr-6">
          <ArgnotToken class="w-16" />
        </div>
        <div class="flex flex-col justify-between items-start grow">
          <div class="text-xl font-bold">Argonot</div>
          <div class="">{{ fmtCommas(mngWallet.argonots) }} ARGNOT</div>
        </div>
        <div class="flex flex-col justify-between items-end">
          <div class="font-bold">
            {{ currencyStore.currencySymbol }}{{ fmtMoney(argonotTo(mngWallet.argonots)) }}
          </div>
          <div class="">0.03%</div>
        </div>
      </MenuButton>
      <transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0 translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-1"
      >
        <MenuItems
          as="div"
          v-slot="{ close }"
          :style="menuPositioning"
          class="absolute z-100 flex max-w-min focus:outline-none"
        >
          <div
            class="flex flex-col p-1 shrink rounded bg-slate-50 text-sm/6 font-semibold text-gray-900 shadow-lg ring-1 ring-gray-900/20 whitespace-nowrap"
          >
            <MenuItem
              as="a"
              @click="
                navigate('receive');
                close();
              "
              class="flex flex-row justify-between py-1 px-2 !text-gray-900 hover:!text-indigo-600 hover:bg-slate-200/60 cursor-pointer"
            >
              Receive
            </MenuItem>
            <MenuItem
              as="a"
              @click="
                navigate('send');
                close();
              "
              class="flex flex-row justify-between py-1 px-2 !text-gray-900 hover:!text-indigo-600 hover:bg-slate-200/60 cursor-pointer"
            >
              Send
            </MenuItem>
            <MenuItem
              as="a"
              href="https://app.uniswap.org/explore/tokens/ethereum/0x6a9143639d8b70d50b031ffad55d4cc65ea55155"
              target="_blank"
              class="flex flex-row justify-between py-1 px-2 !text-gray-900 hover:!text-indigo-600 hover:bg-slate-200/60 cursor-pointer"
            >
              Open Uniswap Market
            </MenuItem>
          </div>
        </MenuItems>
      </transition>
    </Menu>
  </ul>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue';
import { useCurrencyStore } from '../../stores/currency';
import { fmtCommas, fmtMoney } from '../../lib/Utils';
import ArgnToken from '../../assets/tokens/argn.svg?component';
import ArgnotToken from '../../assets/tokens/argnot.svg?component';

const currencyStore = useCurrencyStore();
const { argonTo, argonotTo } = currencyStore;
const mngWallet = Vue.computed(() => currencyStore.mngWallet);

const emit = defineEmits(['navigate']);

const menuPositioning = Vue.ref({
  left: '0px',
  top: '0px',
  bottom: 'auto',
});

const argonMenuButton = Vue.ref<typeof MenuButton>();
const argonotMenuButton = Vue.ref<typeof MenuButton>();

const argonPopoverOpen = Vue.ref(false);
const argonotPopoverOpen = Vue.ref(false);

function navigate(screen: string) {
  emit('navigate', { screen });
}

function setMenuPositioning(event: MouseEvent, isOpen: boolean, menuButton: typeof MenuButton) {
  if (!event.clientX || !event.clientY) return;

  // Check if menu would extend below viewport
  const viewportHeight = window.innerHeight;
  const distanceFromBottom = viewportHeight - event.clientY;
  const shouldPositionAbove = distanceFromBottom < 300;

  const rect = (event.target as HTMLElement).getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = shouldPositionAbove ? rect.bottom - event.clientY : event.clientY - rect.top;

  const newMenuPositioning = {
    left: `${x}px`,
    top: shouldPositionAbove ? 'auto' : `${y}px`,
    bottom: shouldPositionAbove ? `${y}px` : 'auto',
  };

  const leftHasChanged = newMenuPositioning.left !== menuPositioning.value.left;
  const topHasChanged = newMenuPositioning.top !== menuPositioning.value.top;
  if (leftHasChanged || topHasChanged) {
    menuPositioning.value = newMenuPositioning;
    if (isOpen) {
      menuButton.$el.click();
    }
  }
}
</script>
