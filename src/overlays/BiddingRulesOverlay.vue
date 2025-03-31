<template>
  <TransitionRoot class='absolute inset-0' :show="isOpen">
    <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
      <BgOverlay @close="closeOverlay" />
    </TransitionChild>

    <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" enter-to="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200" leave-from="opacity-100 translate-y-0 sm:scale-100" leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
      <div class="flex flex-col absolute top-[52px] left-0 right-0 bottom-0 z-100 pt-[1px] rounded-b-lg">
        <div class="absolute -top-[13px] right-4 w-[30px] h-[17px] overflow-hidden z-10 border-b-2 border-argon-menu-bg">
          <div class="relative top-[5px] left-[5px] w-[20px] h-[20px] rotate-45 bg-slate-50 ring-1 ring-gray-900/20"></div>
        </div>
        <div class="flex flex-col relative grow transform overflow-hidden rounded-b-lg rounded-t-sm border-t border-black/30 bg-argon-menu-bg text-left transition-all w-full" style="box-shadow: 0px -1px 2px 0 rgba(0, 0, 0, 0.1), inset 0 2px 0 rgba(255,255,255,1)">
          <h2 class="relative text-3xl font-bold text-center border-b border-slate-300 pt-8 pb-6 mx-4 cursor-pointer text-[#672D73]">
            Set Up Bidding Rules
          </h2>

          <div class="grow relative w-full">
            <div class="absolute h-[100px] left-0 right-0 bottom-0 z-10 bg-gradient-to-b from-transparent to-argon-menu-bg pointer-events-none"></div>
            <div class="absolute top-0 left-0 right-0 bottom-0 px-[16%] overflow-y-scroll pt-8 pb-[80px]">

              <p>Argon Commander comes with an automated bidding bot. This page allows you to set the rules for how it should operate on your behalf. </p>

              <div class="flex flex-col bg-[#f4ebf6] border border-[#A600D4] rounded-md p-4">
                <header class="!border-b-transparent">What Is Your Seat Goal?</header>
                <p>This is the minimum amount you want to bid. The bot will start bidding at this price.</p>
              </div>

              <header>Minimum Bids</header>
              <p>This is the minimum amount you want to bid. The bot will start bidding at this price.</p>

              <div class="flex flex-row w-full">
                <Listbox as="div" v-model="selected" class="w-1/2">
                  <ListboxLabel class="sr-only">Change published status</ListboxLabel>
                  <div class="relative mt-2">
                    <ListboxButton class="grid w-full cursor-default grid-cols-1 rounded-md bg-white py-1.5 pl-3 pr-2 text-left text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6">
                      <span class="col-start-1 row-start-1 flex items-center gap-3 pr-6">
                        <span class="block truncate">{{ selected.title }}</span>
                      </span>
                      <ChevronUpDownIcon class="col-start-1 row-start-1 size-5 self-center justify-self-end text-gray-500 sm:size-4" aria-hidden="true" />
                    </ListboxButton>

                    <transition leave-active-class="transition ease-in duration-100" leave-from-class="opacity-100" leave-to-class="opacity-0">
                      <ListboxOptions class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm">
                        <ListboxOption as="template" v-for="option in publishingOptions" :key="option.title" :value="option" v-slot="{ active, selected }">
                          <li :class="[active ? 'bg-indigo-600 text-white' : 'text-gray-900', 'cursor-default select-none p-4 text-sm']">
                            <div class="flex flex-col">
                              <div class="flex justify-between">
                                <p :class="selected ? 'font-semibold' : 'font-normal'">{{ option.title }}</p>
                                <span v-if="selected" :class="active ? 'text-white' : 'text-indigo-600'">
                                  <CheckIcon class="size-5" aria-hidden="true" />
                                </span>
                              </div>
                              <p :class="[active ? 'text-indigo-200' : 'text-gray-500', 'mt-2']">{{ option.description }}</p>
                            </div>
                          </li>
                        </ListboxOption>
                      </ListboxOptions>
                    </transition>
                  </div>
                </Listbox>
              </div>

              <p>This is the amount you want to bid each time. The bot will bid this amount each time it bids.</p>
              <input type="text" class="w-1/2 bg-white border border-gray-300 rounded-md px-2 py-1" value="1.00">

              <header>Maximum Bids</header>
              <p>This is the maximum amount you want to bid. The bot will stop bidding when it reaches this price.</p>

              <div class="flex flex-row w-full">
                <Listbox as="div" v-model="selected" class="w-1/2">
                  <ListboxLabel class="sr-only">Change published status</ListboxLabel>
                  <div class="relative mt-2">
                    <ListboxButton class="grid w-full cursor-default grid-cols-1 rounded-md bg-white py-1.5 pl-3 pr-2 text-left text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6">
                      <span class="col-start-1 row-start-1 flex items-center gap-3 pr-6">
                        <span class="block truncate">{{ selected.title }}</span>
                      </span>
                      <ChevronUpDownIcon class="col-start-1 row-start-1 size-5 self-center justify-self-end text-gray-500 sm:size-4" aria-hidden="true" />
                    </ListboxButton>

                    <transition leave-active-class="transition ease-in duration-100" leave-from-class="opacity-100" leave-to-class="opacity-0">
                      <ListboxOptions class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm">
                        <ListboxOption as="template" v-for="option in publishingOptions" :key="option.title" :value="option" v-slot="{ active, selected }">
                          <li :class="[active ? 'bg-indigo-600 text-white' : 'text-gray-900', 'cursor-default select-none p-4 text-sm']">
                            <div class="flex flex-col">
                              <div class="flex justify-between">
                                <p :class="selected ? 'font-semibold' : 'font-normal'">{{ option.title }}</p>
                                <span v-if="selected" :class="active ? 'text-white' : 'text-indigo-600'">
                                  <CheckIcon class="size-5" aria-hidden="true" />
                                </span>
                              </div>
                              <p :class="[active ? 'text-indigo-200' : 'text-gray-500', 'mt-2']">{{ option.description }}</p>
                            </div>
                          </li>
                        </ListboxOption>
                      </ListboxOptions>
                    </transition>
                  </div>
                </Listbox>
              </div>

              <header>Throttles</header>
              <p>This is the number of seats you want to win. The bot will keep bidding until it has won the desired number of seats.</p>

              <div class="flex flex-row w-full">
                <input type="checkbox" name="SeatStrategy" />
                Cap at 
                <div class="flex items-center rounded-md bg-white px-3 outline outline-1 -outline-offset-1 outline-gray-300 focus-within:outline focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-indigo-600">
                  <input type="text" name="price" id="price" class="block min-w-0 grow py-1.5 pl-1 pr-3 text-base text-gray-900 placeholder:text-gray-400 focus:outline focus:outline-0" placeholder="1" aria-describedby="price-currency" />
                  <div id="price-currency" class="shrink-0 select-none text-base text-gray-500 sm:text-sm/6">Active Seats</div>
                </div>
                <div>
                  Per Slot
                </div>
              </div>

              <div class="flex flex-row">
                <input type="checkbox" name="SeatStrategy" />
                Attempt Even Mining Distribution Across All Slots (RECOMMENDED)
              </div>

              <header>Bot Longevity</header>
              <p>This is the amount of time you want the bot to run. The bot will stop bidding after this amount of time.</p>
              <div>
                <RadioButton name="botLongevity" /> Allow bot to continue renewing my seats every epoch (10 days)
              </div>
              <div>
                <RadioButton name="botLongevity" /> Disable bot after winning next slot
              </div>
              <div>
                <RadioButton name="botLongevity" /> Disable bot now
              </div>
            </div>
          </div>
          
          <div class="flex flex-row justify-end px-4 border-t border-slate-300 mx-4 py-4 space-x-4 rounded-b-lg">
            <button @click="closeOverlay" class="border border-[#A600D4] text-xl font-bold text-gray-500 px-7 py-2 rounded-md cursor-pointer">
              <span>Close</span>
            </button>
            <button @click="saveRules" class="bg-[#A600D4] text-xl font-bold text-white px-7 py-2 rounded-md cursor-pointer">
              <span v-if="!isSaving">Save Rules</span>
              <span v-else>Saving Rules...</span>
            </button>
          </div>
        </div>
      </div>
    </TransitionChild>
  </TransitionRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { invoke } from "@tauri-apps/api/core";
import { TransitionChild, TransitionRoot } from '@headlessui/vue';
import emitter from '../emitters/basic';
import { useServerStore } from '../stores/server';
import BgOverlay from '../components/BgOverlay.vue';
import { Listbox, ListboxButton, ListboxLabel, ListboxOption, ListboxOptions } from '@headlessui/vue'
import { ChevronUpDownIcon } from '@heroicons/vue/16/solid'
import { CheckIcon } from '@heroicons/vue/20/solid'
import RadioButton from '../components/RadioButton.vue';

const serverStore = useServerStore();

const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);
const isSaving = Vue.ref(false);

const publicKey = Vue.ref('');
const ipAddress = Vue.ref('');

const publishingOptions = [
  { title: 'Zero', description: 'Place a starting price of nothing.', current: true },
  { title: 'First Bid', description: 'Always ensure your bid’s price is high enough to be at the top of the stack.', current: false },
  { title: 'Middle Bid', description: 'Always ensure your bid’s price is high enough to be at the top of the stack.', current: false },
  { title: 'Last Bid', description: 'Always ensure your bid’s price is high enough to be at the top of the stack.', current: false },
  { title: 'Minimum Breakeven', description: 'Always ensure your bid’s price is high enough to be at the top of the stack.', current: false },
  { title: 'Optimistic Breakeven', description: 'Always ensure your bid’s price is high enough to be at the top of the stack.', current: false },
  { title: 'Amount In Account', description: 'Always ensure your bid’s price is high enough to be at the top of the stack.', current: false },
  { title: 'Custom Amount', description: 'Always ensure your bid’s price is high enough to be at the top of the stack.', current: false },

]

const selected = Vue.ref(publishingOptions[0])

emitter.on('openBiddingRulesOverlay', async () => {
  isOpen.value = true;
  isLoaded.value = true;
});

const saveRules = () => {
  isSaving.value = true;
}

const closeOverlay = () => {
  isOpen.value = false;
  isLoaded.value = false;
};
</script>

<style scoped>
@reference "../main.css";

header {
  @apply text-2xl font-bold pb-3 mb-2 pt-5 border-b border-slate-300;
}
</style>