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

              <ul Steps class="flex flex-col gap-4 w-full">
                <li>
                  <header>1. Open DigitalOcean.com</header>
                  <div wrapper>
                    <div>
                      <p>
                        Go to digitalocean.com ("DO")and sign up for a new account. Skip to step 3 if you already have an account.
                      </p>
                      <p>
                        Be aware that DO routinely gives out $100-$200 in free server credits, but clicking the Sign
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
                        Fill out the short form, confirm your email address, and input your credit card (even if you have free credits, you'll still need a card on file).
                      </p>
                      <p>Don't skip past the welcome screen. We'll use this as the jumping off point for the next step.</p>
                    </div>
                    <img src="/create-do/step2.png" />
                  </div>
                </li>

                <li>
                  <header>3. Click to Create a Virtual Machine</header>
                  <div wrapper>
                    <div>
                      <p>
                        Once your account is setup, you will be given several options. Click the "Deploy a Virtual Machine" button. If you have an existing account,
                        use the "Create a Droplet". Don't create a "GPU Droplet", just a standard Droplet. BTW, Droplets are DO's lingo for what everyone else calls 
                        servers. Regardless, you'll be given a few options for how you want to create your server...
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
                        You can skip all the options at the top (DO's defaults are great). Under the Choose An Image section, click the "Marketplace" tab. Under "Recommended for You" select "Docker on Ubuntu 22.04".
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
                        Under the Choose Size section, select "Basic" for Droplet Type. 
                      </p>
                      <p>
                        Under "CPU Options" select "Premium Intel" and then the $32/mo. This is plenty of power for Argon mining. And hopefully you have the $200 in credits which makes this free.
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
                        Skip down to the "Choose Authentication Method" and select "SSH Key" then "Add SSH Key". This will popup an overlay with a text box.
                      </p>
                      <p>
                        Copy and paste the following public key:
                      </p>
                      <div class="relative mb-3" @click="highlightAndCopy">
                        <input type="text" :value="serverStore.publicKey" class="bg-white py-1 pl-4 pr-8 border border-slate-300 rounded-full w-full pointer-events-none" readonly />
                        <div class="absolute right-8 top-1 w-10 bottom-1 bg-gradient-to-r from-transparent to-white pointer-events-auto"></div>
                        <div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <CopyIcon class="w-4 h-4" />
                        </div>
                        <div v-if="showCopied" class="absolute top-0 right-0 bottom-0 bg-gray-800 text-white px-6 flex items-center rounded-l-md rounded-r-full text-sm transition-opacity duration-200 whitespace-nowrap">
                          Copied
                        </div>
                      </div>
                      <p>You'll need to give this key a name. We recommend "Argon Commander". Click "Add SSH Key".</p>
                    </div>
                    <img src="/create-do/step6.png" />
                  </div>
                </li>

                <li>
                  <header>7. Finalize Your New Server</header>
                  <div wrapper>
                    <div>
                      <p>
                        We're almost done. Click the "Create Droplet" button, and wait for your new server to boot up.
                      </p>
                    </div>
                    <img src="/create-do/step7.png" />
                  </div>
                </li>

                <li>
                  <header>8. Copy and Paste Your IP Address</header>
                  <div wrapper>
                    <div>
                      <p>
                        Once your server is booted up, you'll need to copy and paste the IP address into the input box below.
                      </p>
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
                      <input type="text" v-model="ipAddress" placeholder="Your Server's IP Address" class="w-full border bg-white border-slate-300 rounded-md p-2" />
                    </div>
                    <img src="/create-do/step8.png" />
                  </div>
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
import CopyIcon from '../assets/copy.svg';
import { ExclamationTriangleIcon } from '@heroicons/vue/20/solid'

const serverStore = useServerStore();

const isOpen = Vue.ref(false);
const isSaving = Vue.ref(false);
const showCopied = Vue.ref(false);

const ipAddress = Vue.ref('');
const ipAddressError = Vue.ref(false);
emitter.on('openConnectCloudOverlay', async () => {
  isOpen.value = true;
});

const closeOverlay = () => {
  isOpen.value = false;
};

async function addServer() {
  isSaving.value = true;
  if (ipAddress.value === '') {
    ipAddressError.value = true;
    isSaving.value = false;
    return;
  }
  await serverStore.saveServer(ipAddress.value);
  closeOverlay();
  isSaving.value = false;
}

function highlightAndCopy(event: Event) {
  const input = (event.target as HTMLElement).querySelector('input') as HTMLInputElement;
  input.select();
  navigator.clipboard.writeText(input.value);
  showCopied.value = true;
  setTimeout(() => {
    showCopied.value = false;
  }, 2000);
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
    & > div {
      @apply grow;
    }
  }
  p {
    @apply mb-3;
  }
  img {
    @apply w-60 object-contain border border-black/40 rounded-md relative top-1;
  }
}
</style>