<template>
  <TransitionRoot
    :show="isOpen"
    as="template"
    enter="duration-300 ease-out"
    enter-from="opacity-0"
    enter-to="opacity-100"
    leave="duration-200 ease-in"
    leave-from="opacity-100"
    leave-to="opacity-0"
  >
    <Dialog @close="maybeCloseOverlay" :initialFocus="dialogPanel">
      <DialogPanel class="absolute top-0 left-0 right-0 bottom-0 z-10">
        <BgOverlay @close="maybeCloseOverlay" />
        <div
          ref="dialogPanel"
          class="absolute top-[40px] left-3 right-3 bottom-3 flex flex-col overflow-hidden rounded-md border border-black/30 inner-input-shadow bg-argon-menu-bg text-left transition-all"
          style="
            box-shadow:
              0px -1px 2px 0 rgba(0, 0, 0, 0.1),
              inset 0 2px 0 rgba(255, 255, 255, 1);
          "
        >
          <div v-if="isLoaded" class="flex flex-col h-full w-full">
            <h2
              class="relative text-3xl font-bold text-center border-b border-slate-300 pt-5 pb-4 pl-3 mx-4 cursor-pointer text-[#672D73]"
              style="box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1)"
            >
              Connect Your Cloud Machine
              <div
                @click="closeOverlay"
                class="absolute top-[22px] right-[0px] z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/70 hover:bg-[#D6D9DF]"
              >
                <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
              </div>
            </h2>

            <div class="grow relative w-full">
              <div
                class="absolute h-[20px] left-0 right-0 bottom-0 z-10 bg-gradient-to-b from-transparent to-argon-menu-bg pointer-events-none"
              ></div>
              <div class="absolute top-0 left-0 right-0 bottom-0 px-[6%] overflow-y-scroll pt-8 pb-[50px]">
                <p class="text-gray-500 border-b border-slate-300 pb-4 mb-8">
                  Argon Commander will automatically setup and configure your mining server. All you need to do is
                  activate it. The following steps show you how to activate a new server at Digital Ocean. Please follow
                  each step exactly as shown -- the details are important!
                </p>

                <ul Steps class="flex flex-col gap-4 w-full">
                  <li>
                    <header>1. Open DigitalOcean.com</header>
                    <div wrapper>
                      <div>
                        <p>
                          Go to digitalocean.com ("DO")and sign up for a new account. Skip to step 3 if you already have
                          an account.
                        </p>
                        <p>
                          Be aware that DO routinely gives out $100-$200 in free server credits, but clicking the Sign
                          Up link in the top right corner will NOT give you those credits. At the time of this writing,
                          scrolling to the bottom of the page and clicking the "Get Started" button will give you the
                          free credits.
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
                          Fill out the short form, confirm your email address, and input your credit card (even if you
                          have free credits, you'll still need a card on file).
                        </p>
                        <p>
                          Don't skip past the welcome screen. We'll use this as the jumping off point for the next step.
                        </p>
                      </div>
                      <img src="/create-do/step2.png" />
                    </div>
                  </li>

                  <li>
                    <header>3. Click to Create a Virtual Machine</header>
                    <div wrapper>
                      <div>
                        <p>
                          Once your account is setup, you will be given several options. Click the "Deploy a Virtual
                          Machine" button. If you have an existing account, use the "Create a Droplet". Don't create a
                          "GPU Droplet", just a standard Droplet. BTW, Droplets are DO's lingo for what everyone else
                          calls servers. Regardless, you'll be given a few options for how you want to create your
                          server...
                        </p>
                      </div>
                      <img src="/create-do/step3.png" />
                    </div>
                  </li>

                  <li>
                    <header>4. Keep Default Docker Image</header>
                    <div wrapper>
                      <div>
                        <p>
                          You should use all the default options when creating your new droplet, including Digital
                          Ocean's default image. It should be set to Ubuntu version 24.10 x64.
                        </p>
                        <p>Keep on scrolling.</p>
                      </div>
                      <img src="/create-do/step4.png" />
                    </div>
                  </li>

                  <li>
                    <header>5. Choose Basic Size</header>
                    <div wrapper>
                      <div>
                        <p>Under the Choose Size section, select "Basic" for Droplet Type.</p>
                        <p>
                          For the "CPU Options" select "Premium Intel" and then the $32/mo. This is plenty of power for
                          Argon mining. Hopefully you have $200 in credits which makes this free.
                        </p>
                      </div>
                      <img src="/create-do/step5.png" />
                    </div>
                  </li>

                  <li>
                    <header>6. Copy Your SSH Key</header>
                    <div wrapper>
                      <div>
                        <p>
                          Skip down to the "Choose Authentication Method" and select "SSH Key" then "Add SSH Key". This
                          will pop up an overlay with a text box.
                        </p>
                        <p>Copy and paste the following public key:</p>
                        <CopyToClipboard
                          ref="copyToClipboard"
                          :content="serverDetails.sshPublicKey"
                          class="relative mb-3"
                          @click="highlightCopiedContent"
                        >
                          <input
                            type="text"
                            :value="serverDetails.sshPublicKey"
                            class="bg-white py-4 pl-4 pr-8 border border-slate-300 rounded-md w-full pointer-events-none"
                            readonly
                          />
                          <div
                            class="absolute right-8 top-1 w-10 bottom-1 bg-gradient-to-r from-transparent to-white pointer-events-auto"
                          ></div>
                          <div class="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer">
                            <CopyIcon class="w-4 h-4 opacity-80" />
                          </div>
                          <template #copied>
                            <div
                              class="bg-white py-4 pl-4 pr-8 border border-slate-300 rounded-md w-full pointer-events-none overflow-hidden"
                            >
                              <span class="bg-blue-200 whitespace-nowrap w-full inline-block">
                                {{ serverDetails.sshPublicKey }}
                              </span>
                            </div>
                            <div
                              class="flex flex-row items-center absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none bg-white pl-2"
                            >
                              <div
                                class="absolute -left-8 w-8 top-0 bottom-0 bg-gradient-to-r from-transparent to-white pointer-events-auto"
                              ></div>
                              <span class="font-bold text-blue-800/60">Copied</span>
                              <CopyIcon class="w-4 h-4 ml-3 text-blue-600" />
                            </div>
                          </template>
                        </CopyToClipboard>
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
                          Under "Finalze Details", you can optionally customize the hostname of your server. This is
                          used in Digital Ocean's control panel to identify your server (by default they use a long
                          convoluted name). Use whatever name you want. It is for your eyes only.
                        </p>
                        <p>Click the "Create Droplet" button, and wait for your new server to boot up.</p>
                      </div>
                      <img src="/create-do/step7.png" />
                    </div>
                  </li>

                  <li>
                    <header>8. Find Your Server's IP Address</header>
                    <div wrapper>
                      <div>
                        <p>
                          Once your server is provisioned (this might take a few minutes), you'll need to copy and paste
                          the server's IP address into the input box below. If you see a blue progress bar, it means
                          your server is still provisioning. Give it some time, and it will appear.
                        </p>
                        <div v-if="hasIpAddressError" class="rounded-md bg-red-200 p-2 mb-2">
                          <div class="flex">
                            <div class="shrink-0">
                              <ExclamationTriangleIcon class="size-5 text-red-400" aria-hidden="true" />
                            </div>
                            <div class="ml-3">
                              <h3 class="text-sm font-medium text-red-800">IP Address cannot be left blank</h3>
                            </div>
                          </div>
                        </div>
                        <input
                          type="text"
                          v-model="ipAddress"
                          placeholder="Your Server's IP Address"
                          class="w-full border bg-white border-slate-300 rounded-md px-4 py-4"
                        />
                      </div>
                      <img src="/create-do/step8.png" />
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div
            v-if="isOpen"
            class="flex flex-row justify-end px-4 border-t border-slate-300 mx-4 py-4 space-x-4 rounded-b-lg"
          >
            <div v-if="hasServerDetailsError" class="grow rounded-md bg-red-200 p-2 pl-4 flex items-center">
              <div class="flex">
                <div class="shrink-0">
                  <ExclamationTriangleIcon class="size-5 text-red-400" aria-hidden="true" />
                </div>
                <div class="ml-3">
                  <h3 class="text-sm font-medium text-red-800">
                    Failed to connect to server. Please ensure you used the correct Public Key.
                  </h3>
                </div>
              </div>
            </div>
            <button
              @click="closeOverlay"
              class="border border-[#A600D4] text-xl font-bold text-gray-500 px-7 py-2 rounded-md cursor-pointer"
            >
              <span>Close</span>
            </button>
            <button
              @click="addServer"
              class="bg-[#A600D4] text-xl font-bold text-white px-7 py-2 rounded-md cursor-pointer"
            >
              <span v-if="!isSaving">Add Server</span>
              <span v-else>Adding Server...</span>
            </button>
          </div>
        </div>
      </DialogPanel>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import dayjs from 'dayjs';
import { TransitionRoot, Dialog, DialogPanel } from '@headlessui/vue';
import emitter from '../emitters/basic';
import { useConfig } from '../stores/config';
import BgOverlay from '../components/BgOverlay.vue';
import CopyIcon from '../assets/copy.svg?component';
import { ExclamationTriangleIcon } from '@heroicons/vue/20/solid';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import CopyToClipboard from '../components/CopyToClipboard.vue';
import { SSH } from '../lib/SSH';
import { IConfigServerDetails } from '../interfaces/IConfig';

const config = useConfig();
const serverDetails = Vue.computed(() => config.serverDetails);

let openedAt = dayjs();

const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);
const isSaving = Vue.ref(false);

const ipAddress = Vue.ref('');
const hasIpAddressError = Vue.ref(false);
const hasServerDetailsError = Vue.ref(false);

const dialogPanel = Vue.ref(null);
const copyToClipboard = Vue.ref<typeof CopyToClipboard>();

emitter.on('openServerConnectOverlay', async () => {
  isOpen.value = true;
  isLoaded.value = true;
});

function maybeCloseOverlay() {
  const secondsSinceOpened = dayjs().diff(openedAt, 'seconds');
  if (secondsSinceOpened < 2) {
    closeOverlay();
  }
}

const closeOverlay = () => {
  isOpen.value = false;
  isLoaded.value = false;
};

async function addServer() {
  isSaving.value = true;
  hasIpAddressError.value = false;
  hasServerDetailsError.value = false;

  if (ipAddress.value === '') {
    hasIpAddressError.value = true;
    isSaving.value = false;
    return;
  }

  try {
    const newServerDetails: IConfigServerDetails = {
      ...config.serverDetails,
      ipAddress: ipAddress.value,
    };
    await SSH.ensureConnection(newServerDetails);
    await SSH.runCommand("echo 'test'");

    config.isServerNew = true;
    config.isServerConnected = true;
    config.isServerInstalling = true;
    config.serverDetails = newServerDetails;
    config.save();
    closeOverlay();
  } catch (error) {
    console.log('error', error);
    hasServerDetailsError.value = true;
  }
  isSaving.value = false;
}

function highlightCopiedContent() {
  const wrapperElem = copyToClipboard.value?.$el;
  if (!wrapperElem) return;

  const inputElem = wrapperElem.querySelector('input') as HTMLInputElement;
  inputElem.select();
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

h2 {
  position: relative;
  &:before {
    @apply bg-gradient-to-r from-argon-menu-bg to-transparent;
    content: '';
    display: block;
    width: 30px;
    position: absolute;
    z-index: 1;
    left: -5px;
    top: 0;
    bottom: -5px;
  }
  &:after {
    @apply bg-gradient-to-l from-argon-menu-bg to-transparent;
    content: '';
    display: block;
    width: 30px;
    position: absolute;
    z-index: 1;
    right: -5px;
    top: 0;
    bottom: -5px;
  }
}
</style>
