<template>
  <TransitionRoot class='absolute inset-0' :show="isOpen">
    <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
      <BgOverlay @close="closeOverlay" :allowCurrencyMenu="false" />
    </TransitionChild>

    <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" enter-to="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200" leave-from="opacity-100 translate-y-0 sm:scale-100" leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
      <div class="flex flex-col absolute top-[52px] left-0 right-0 bottom-0 z-100 pt-[1px] rounded-b-lg">
        <div class="absolute -top-[13px] right-4 w-[30px] h-[17px] overflow-hidden z-10 border-b-2 border-argon-menu-bg">
          <div class="relative top-[5px] left-[5px] w-[20px] h-[20px] rotate-45 bg-slate-50 ring-1 ring-gray-900/20"></div>
        </div>
        <div class="flex flex-col relative grow transform overflow-hidden rounded-b-lg rounded-t-sm border-t border-black/30 bg-argon-menu-bg text-left transition-all w-full" style="box-shadow: 0px -1px 2px 0 rgba(0, 0, 0, 0.1), inset 0 2px 0 rgba(255,255,255,1)">
          <h2 class="relative text-3xl font-bold text-center border-b border-slate-300 pt-8 pb-6 mx-4 cursor-pointer text-[#672D73]">
            Connect Your Cloud Machine
          </h2>
          <div class="grow relative w-full">
            <div class="absolute h-[100px] left-0 right-0 bottom-0 z-10 bg-gradient-to-b from-transparent to-argon-menu-bg pointer-events-none"></div>
            <div class="absolute top-0 left-0 right-0 bottom-0 px-[16%] overflow-y-scroll pt-8 pb-[80px]">
              <p class="text-gray-500 border-b border-slate-300 pb-4 mb-8">
                Argon Commander will automatically setup and configure your mining server. All you need to do is activate it. The following steps show you how to activate a new server at Digital Ocean. Please follow each step exactly as shown -- the details are important!
              </p>

              <ul Steps class="flex flex-col gap-4">
                <li>
                  <header>1. Open DigitalOcean.com</header>
                  <div wrapper>
                    <div>
                      <p>
                        Go to digitalocean.com and sign up for a new account.
                      </p>
                      <p>
                        Be aware that Digital Ocean routinely gives out $100-$200 in free server credits, but clicking the Sign
                        Up link in the top right corner will NOT give you those credits. At the time of this writing, scrolling to the bottom of the page and clicking 
                        the "Get Started" button will give you the free credits.
                      </p>
                    </div>
                    <img src="/create-do/step1.png" />
                  </div>
                </li>

                <li>
                  <header>2. Fill Out the Sign Up Form</header>
                  <div wrapper>
                    <div>
                      <p>
                        Fill out the form, confirm your email address, and input your credit card (there are multiple ways to get $100-$200 in free server credits… google it).
                      </p>
                    </div>
                    <img src="/create-do/step2.png" />
                  </div>
                </li>

                <li>
                  <header>3. Click Deploy a Virtual Machine</header>
                  <div wrapper>
                    <div>
                      <p>
                        Whether you have an existing account or new account, you'll want to Create a Droplet (this is DO's lingo for creating a server).
                        Once your account is setup, you will be given several options. Click the "Deploy a Virtual Machine."
                      </p>
                    </div>
                    <img src="/create-do/step3.png" />
                  </div>
                </li>

                <li>
                  <header>4. Choose Docker Image</header>
                  <div wrapper>
                    <div>
                      <p>
                        Under the Choose An Image section, click the "Marketplace" tab. Then under "Recommended for You" select "Docker on Ubuntu 22.04".
                      </p>
                    </div>
                    <img src="/create-do/step4.png" />
                  </div>
                </li>

                <li>
                  <header>5. Choose Basic Size</header>
                  <div wrapper>
                    <div>
                      <p>
                        Under the Choose An Image section, click the "Marketplace" tab. Then under "Recommended for You" select "Docker on Ubuntu 22.04".
                      </p>
                    </div>
                    <img src="/create-do/step5.png" />
                  </div>
                </li>

                <li>
                  <header>6. Copy Our SSH Key</header>
                  <div wrapper>
                    <div>
                      <p>
                        Click the "Upload SSH Key" button and paste the following public key:
                    <pre class="bg-slate-100 p-2 border border-slate-300 rounded-md">{{ serverStore.publicKey }}</pre>
                      </p>
                    </div>
                    <img src="/create-do/step6.png" />
                  </div>
                </li>

                <li>
                  <header>6. Finalize Your New Server</header>
                  Click the "Create Droplet" button.
                </li>

                <li>
                  <header>7. Copy and Paste Your IP Address</header>
                  <input type="text" v-model="ipAddress" class="w-full border border-slate-300 rounded-md p-2" />
                </li>
              </ul>
            </div>
          </div>

          <div class="flex flex-row justify-end px-4 border-t border-slate-300 mx-4 py-4 space-x-4 rounded-b-lg">
            <button @click="closeOverlay" class="border border-[#A600D4] text-xl font-bold text-gray-500 px-7 py-2 rounded-md cursor-pointer">
              <span>Close</span>
            </button>
            <button @click="addServer" class="bg-[#A600D4] text-xl font-bold text-white px-7 py-2 rounded-md cursor-pointer">
              <span v-if="!isSaving">Add Server</span>
              <span v-else>Adding Server...</span>
            </button>
          </div>
        </div>
      </div>
    </TransitionChild>
  </TransitionRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { TransitionChild, TransitionRoot } from '@headlessui/vue';
import emitter from '../emitters/basic';
import { useServerStore } from '../stores/server';
import BgOverlay from '../components/BgOverlay.vue';

const serverStore = useServerStore();

const isOpen = Vue.ref(false);
const isSaving = Vue.ref(false);

const publicKey = Vue.ref('');
const ipAddress = Vue.ref('');

emitter.on('openConnectCloudOverlay', async () => {
  isOpen.value = true;
});

const closeOverlay = () => {
  isOpen.value = false;
};

async function addServer() {
  isSaving.value = true;
  await serverStore.saveServer(ipAddress.value);
  closeOverlay();
  isSaving.value = false;
}
</script>

<style scoped>
@reference "../main.css";

ul[Steps] li {
  @apply flex flex-col gap-2 mb-5;
  header {
    @apply text-lg font-bold;
  }
  [wrapper] {
    @apply flex flex-row gap-x-10 items-start;
  }
  p {
    @apply mb-3;
  }
  img {
    @apply w-60 object-contain border border-black/40 rounded-md;
  }
}
</style>