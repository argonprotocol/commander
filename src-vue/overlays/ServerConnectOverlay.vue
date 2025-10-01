<template>
  <DialogRoot class="absolute inset-0 z-10" :open="isOpen">
    <DialogPortal>
      <DialogOverlay asChild>
        <BgOverlay @close="cancelOverlay" />
      </DialogOverlay>

      <DialogContent @escapeKeyDown="cancelOverlay" :aria-describedby="undefined">
        <div
          class="ConnectOverlay inner-input-shadow bg-argon-menu-bg absolute top-[40px] right-3 bottom-3 left-3 z-20 flex flex-col overflow-auto rounded-md border border-black/30 text-left transition-all focus:outline-none"
          style="
            box-shadow:
              0 -1px 2px 0 rgba(0, 0, 0, 0.1),
              inset 0 2px 0 rgba(255, 255, 255, 1);
          ">
          <div class="flex w-full flex-col px-4">
            <h2
              class="relative pt-5 pb-4 pl-3 text-left text-3xl font-bold text-[#672D73]"
              style="box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1)">
              <DialogTitle as="div" class="relative z-10">Connect a Server</DialogTitle>
              <div
                @click="cancelOverlay"
                class="absolute top-[22px] right-[0px] z-10 flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-md border border-slate-400/60 text-sm/6 font-semibold hover:border-slate-500/70 hover:bg-[#D6D9DF] focus:outline-none">
                <XMarkIcon class="h-5 w-5 stroke-4 text-[#B74CBA]" />
              </div>
            </h2>

            <DialogDescription class="px-10 py-6 font-light opacity-80">
              Argon Commander will automatically setup and configure your mining server. All you need to do is activate
              it. The following steps show you how to activate a new server. Digital Ocean is shown as a full reference,
              but any Ubuntu 24+ server should work.
            </DialogDescription>

            <TabsRoot class="flex w-full flex-col" :model-value="selectedTab" @update:modelValue="selectedTab = $event">
              <TabsList class="order-slate-400 relative flex shrink-0 text-2xl" aria-label="Setup a server">
                <TabsIndicator
                  class="absolute bottom-0 left-0 h-[2px] translate-y-[1px] rounded-full px-8 transition-[width,transform] duration-300"
                  :style="{
                    width: 'var(--reka-tabs-indicator-size)',
                    transform: `translateX(var(--reka-tabs-indicator-position))`,
                    height: '2px',
                  }">
                  <div class="bg-argon-600 h-full w-full"></div>
                </TabsIndicator>
                <TabsTrigger
                  class="hover:text-argon-800 data-[state=active]:text-argon-600 flex h-[45px] flex-1 cursor-pointer items-center justify-center rounded-tl-md px-5 text-xl leading-none text-slate-500 outline-none select-none data-[state=active]:font-bold"
                  value="do">
                  Digital Ocean
                </TabsTrigger>

                <TabsTrigger
                  class="hover:text-argon-800 data-[state=active]:text-argon-600 flex h-[45px] flex-1 cursor-pointer items-center justify-center rounded-tl-md px-5 text-xl leading-none text-slate-500 outline-none select-none data-[state=active]:font-bold"
                  value="custom">
                  Custom Server
                </TabsTrigger>

                <TabsTrigger
                  class="hover:text-argon-800 data-[state=active]:text-argon-600 flex h-[45px] flex-1 cursor-pointer items-center justify-center rounded-tl-md px-5 text-xl leading-none text-slate-500 outline-none select-none data-[state=active]:font-bold"
                  value="local">
                  Local Machine
                </TabsTrigger>
              </TabsList>
              <TabsContent value="do">
                <div class="mx-5 p-3">
                  <ul Steps class="flex w-full flex-col space-y-6">
                    <li>
                      <div class="rounded-lg border border-slate-300/40 bg-white/80 p-4 shadow-sm">
                        <header class="text-argon-800/60 flex items-center gap-3 text-xl font-semibold">
                          <span
                            class="bg-argon-500 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-white">
                            1
                          </span>
                          Create a Digital Ocean Account
                        </header>
                        <div wrapper class="flex h-full w-full flex-row gap-10 pt-3">
                          <div class="flex w-1/2 flex-col gap-10">
                            <p>
                              Digital Ocean usually has promotional credits for new users. You can use these credits
                              towards your server costs. Follow along with the video to the right to see how to create
                              an account and get free credits.
                              <br />
                              <br />
                              You can open a browser to the signup page
                              <a @click="openDigitalOceanLink" class="!text-argon-600 text-semibold cursor-pointer">
                                here.
                              </a>
                            </p>
                            <p class="bg-slate-200/50 p-3 text-sm">
                              <strong>NOTE:</strong>
                              you might find it helpful to open the video in a new window so you can put it on top of
                              the Digital Ocean website as you fill out the registration form.
                            </p>
                          </div>

                          <YoutubeVideo video-id="iB-8deHtiQk" class="w-1/2" title="Create a Digital Ocean Account" />
                        </div>
                      </div>
                    </li>
                    <li>
                      <div class="rounded-lg border border-slate-300/40 bg-white/80 p-4 shadow-sm">
                        <header class="text-argon-800/60 flex items-center gap-3 text-xl font-semibold">
                          <span
                            class="bg-argon-500 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-white">
                            2
                          </span>
                          Create a Droplet (Server)
                        </header>
                        <div wrapper class="flex h-full w-full flex-row items-start gap-10 pt-3">
                          <div class="w-1/2">
                            <p class="mb-8">
                              You can create a server (called a "Droplet" on Digital Ocean) by following the steps in
                              this video. You will want to create the "Basic", $32 a month droplet. Hopefully you have
                              $200 in credits which makes this free.
                            </p>

                            <a
                              @click="showDetailedServerInstructions = true"
                              class="!text-argon-500 cursor-pointer text-sm"
                              v-if="!showDetailedServerInstructions">
                              > Show "Droplet" Settings
                            </a>
                            <Motion
                              as="div"
                              :initial="{ height: 0, opacity: 0 }"
                              :animate="{ height: 'auto', opacity: 1 }"
                              :exit="{ height: 0, opacity: 0 }"
                              :transition="{ duration: 0.4, ease: 'easeOut' }"
                              class="overflow-hidden rounded bg-slate-200/50 p-3 text-sm text-slate-800"
                              v-else>
                              <h5 class="text-md mb-2 font-bold">
                                Droplet Settings
                                <a
                                  @click="showDetailedServerInstructions = false"
                                  class="!text-argon-500 ml-2 cursor-pointer text-xs">
                                  hide
                                </a>
                              </h5>
                              <table class="m-2">
                                <tbody>
                                  <tr>
                                    <td class="text-argon-800/60 w-1/3">Choose a Region</td>
                                    <td class="w-1/3 font-sans font-bold">Anything here works.</td>
                                    <td>
                                      <ImageZoom
                                        src="/create-do/region.png"
                                        alt="Choose a Region"
                                        add-classes="h-25 w-60" />
                                    </td>
                                  </tr>
                                  <tr>
                                    <td class="text-argon-800/60">Choose an Image</td>
                                    <td class="font-sans font-bold">Ubuntu</td>
                                    <td>
                                      <ImageZoom src="/create-do/step4.png" alt="Ubuntu" add-classes="h-25 w-60" />
                                    </td>
                                  </tr>
                                  <tr>
                                    <td class="text-argon-800/60">Choose Size</td>
                                    <td class="font-sans font-bold">Basic</td>
                                    <td>
                                      <ImageZoom src="/create-do/size.png" alt="Server Size" add-classes="h-25 w-60" />
                                    </td>
                                  </tr>
                                  <tr>
                                    <td class="text-argon-800/60">CPU options</td>
                                    <td class="font-sans font-bold">Premium Intel - $32/mo</td>
                                    <td>
                                      <ImageZoom src="/create-do/cost.png" alt="$32/mo" add-classes="h-25 w-60" />
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </Motion>
                          </div>

                          <YoutubeVideo video-id="bdkupHXnXio" class="w-1/2" title="Create a Droplet" />
                        </div>
                      </div>
                    </li>

                    <li>
                      <div class="rounded-lg border border-slate-300/40 bg-white/80 p-4 shadow-sm">
                        <header class="text-argon-800/60 flex items-center gap-3 text-xl font-semibold">
                          <span
                            class="bg-argon-500 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-white">
                            3
                          </span>
                          Allow Remote Access to Commander
                        </header>
                        <div wrapper>
                          <div class="w-2/3">
                            <p class="my-3">
                              Skip down to the "Choose Authentication Method" and select "SSH Key" then "Add SSH Key".
                              This will pop up an overlay with a text box.
                            </p>
                            <p>Copy and paste the following public key:</p>
                            <CopyToClipboard
                              ref="copyToClipboard"
                              :content="sshPublicKey"
                              class="relative mb-3"
                              @click="highlightCopiedContent">
                              <input
                                type="text"
                                :value="sshPublicKey"
                                class="pointer-events-none w-full rounded-md border border-slate-300 bg-white py-4 pr-8 pl-4"
                                readonly />
                              <div
                                class="pointer-events-auto absolute top-1 right-8 bottom-1 w-10 bg-gradient-to-r from-transparent to-white"></div>
                              <div class="absolute top-1/2 right-4 -translate-y-1/2 cursor-pointer">
                                <CopyIcon class="h-4 w-4 opacity-80" />
                              </div>
                              <template #copied>
                                <div
                                  class="pointer-events-none w-full overflow-hidden rounded-md border border-slate-300 bg-white py-4 pr-8 pl-4">
                                  <span class="inline-block w-full bg-blue-200 whitespace-nowrap">
                                    {{ sshPublicKey }}
                                  </span>
                                </div>
                                <div
                                  class="pointer-events-none absolute top-1/2 right-4 flex -translate-y-1/2 flex-row items-center bg-white pl-2">
                                  <div
                                    class="pointer-events-auto absolute top-0 bottom-0 -left-8 w-8 bg-gradient-to-r from-transparent to-white"></div>
                                  <span class="font-bold text-blue-800/60">Copied</span>
                                  <CopyIcon class="ml-3 h-4 w-4 text-blue-600" />
                                </div>
                              </template>
                            </CopyToClipboard>
                            <p>
                              You'll need to give this key a name. We recommend "Argon Commander". Click "Add SSH Key".
                            </p>
                          </div>
                          <div class="w-1/3">
                            <ImageZoom src="/create-do/step6.png" alt="Add SSH Key" add-classes="aspect-video" />
                          </div>
                        </div>
                      </div>
                    </li>

                    <li>
                      <div class="rounded-lg border border-slate-300/40 bg-white/80 p-4 shadow-sm">
                        <header class="text-argon-800/60 flex items-center gap-3 text-xl font-semibold">
                          <span
                            class="bg-argon-500 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-white">
                            4
                          </span>
                          Find Your Server's IP Address
                        </header>
                        <div wrapper>
                          <div>
                            <p class="my-3">
                              Once your server is provisioned (this might take a few minutes), you'll need to copy and
                              paste the server's IP address into the input box below. If you see a blue progress bar, it
                              means your server is still provisioning. Give it some time, and it will appear.
                            </p>
                            <div class="wrapper mr-4 flex grow flex-col">
                              <div v-if="hasIpAddressError" class="mb-2 rounded-md bg-red-200 p-2">
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
                                v-model="ipAddressAndMaybePort"
                                placeholder="Your Server's IP Address"
                                class="w-full rounded-md border border-slate-300 bg-white px-4 py-4" />
                            </div>
                          </div>
                          <div class="w-1/3">
                            <ImageZoom src="/create-do/step8.png" alt="GetServer IP" add-classes="aspect-video" />
                          </div>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>
              </TabsContent>
              <TabsContent value="custom">
                <div class="mx-5 p-3">
                  <ul Steps class="flex w-full flex-col space-y-6">
                    <li>
                      <div class="rounded-lg border border-slate-300/40 bg-white/80 p-4 shadow-sm">
                        <header class="text-argon-800/60 flex items-center gap-3 text-xl font-semibold">
                          <span
                            class="bg-argon-500 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-white">
                            1
                          </span>
                          Create a Server
                        </header>
                        <div class="flex gap-10 pt-3">
                          <div class="w-1/2">
                            You'll need to provision a machine to run your Bidding Bot, the Argon Blockchain and the
                            Bitcoin Blockchain. The basic requirements of the machine are:
                          </div>

                          <div class="w-1/2 rounded-md bg-slate-50/50">
                            <table class="w-full border border-slate-300/40 bg-white/80 p-4 shadow-sm">
                              <tbody>
                                <tr class="border-b border-dashed border-slate-400/20">
                                  <td
                                    class="text-argon-800/60 border-r border-dashed border-slate-400/20 p-2 pr-4 text-right">
                                    Operating System
                                  </td>
                                  <td class="text-argon-800/80 p-2 pl-4 text-left font-sans font-bold">
                                    Ubuntu 24.04+
                                  </td>
                                </tr>
                                <tr class="border-b border-dashed border-slate-400/20">
                                  <td
                                    class="text-argon-800/60 border-r border-dashed border-slate-400/20 p-2 pr-4 text-right">
                                    Memory
                                  </td>
                                  <td class="text-argon-800/80 p-2 pl-4 font-sans font-bold">4GB+ RAM</td>
                                </tr>
                                <tr class="border-b border-dashed border-slate-400/20">
                                  <td
                                    class="text-argon-800/60 border-r border-dashed border-slate-400/20 p-2 pr-4 text-right">
                                    Compute Cores
                                  </td>
                                  <td class="text-argon-800/80 p-2 pl-4 font-sans font-bold">2+ vCPUs</td>
                                </tr>
                                <tr class="border-b border-dashed border-slate-400/20">
                                  <td
                                    class="text-argon-800/60 border-r border-dashed border-slate-400/20 p-2 pr-4 text-right">
                                    Hard Drive
                                  </td>
                                  <td class="text-argon-800/80 p-2 pl-4 font-sans font-bold">100GB or more</td>
                                </tr>
                                <tr class="border-b border-dashed border-slate-400/20">
                                  <td
                                    class="text-argon-800/60 border-r border-dashed border-slate-400/20 p-2 pr-4 text-right">
                                    Internet Access
                                  </td>
                                  <td class="text-argon-800/80 p-2 pl-4 font-sans font-bold">Public</td>
                                </tr>
                                <tr class="">
                                  <td
                                    class="text-argon-800/60 border-r border-dashed border-slate-400/20 p-2 text-right">
                                    Uptime
                                  </td>
                                  <td class="text-argon-800/80 p-2 pl-4 font-sans font-bold">Always On</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </li>

                    <li>
                      <div class="rounded-lg border border-slate-300/40 bg-white/80 p-4 shadow-sm">
                        <header class="text-argon-800/60 flex items-center gap-3 text-xl font-semibold">
                          <span
                            class="bg-argon-500 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-white">
                            2
                          </span>
                          Allow Remote Access to Commander
                        </header>
                        <div class="flex gap-10 pt-3">
                          <div class="w-1/2">
                            <p>
                              You'll need to add the commander SSH public key to your server's authorized keys.
                              <br />
                              <br />
                              Log-in to your server and run the following command:
                            </p>
                          </div>
                          <div class="w-1/2">
                            <CopyToClipboard
                              ref="copyToClipboard"
                              :content="addSshPublicKey"
                              class="relative mb-3 h-full w-full"
                              @click="highlightCopiedContent">
                              <textarea
                                type="text"
                                :value="addSshPublicKey"
                                class="pointer-events-none h-full w-full rounded-md border border-slate-300 bg-white py-4 pr-8 pl-4"
                                rows="3"
                                readonly />
                              <div
                                class="pointer-events-auto absolute top-1 right-8 bottom-1 w-10 bg-gradient-to-r from-transparent to-white"></div>
                              <div class="absolute top-1/2 right-4 -translate-y-1/2 cursor-pointer">
                                <CopyIcon class="h-4 w-4 opacity-80" />
                              </div>
                              <template #copied>
                                <div
                                  class="pointer-events-none h-full w-full rounded-md border border-slate-300 bg-white py-4 pr-8 pl-4">
                                  <span class="inline-block h-full w-full bg-blue-200" style="word-break: break-word">
                                    {{ addSshPublicKey }}
                                  </span>
                                </div>
                                <div
                                  class="pointer-events-none absolute top-1/2 right-4 flex -translate-y-1/2 flex-row items-center bg-white pl-2">
                                  <div
                                    class="pointer-events-auto absolute top-0 bottom-0 -left-8 w-8 bg-gradient-to-r from-transparent to-white"></div>
                                  <span class="font-bold text-blue-800/60">Copied</span>
                                  <CopyIcon class="ml-3 h-4 w-4 text-blue-600" />
                                </div>
                              </template>
                            </CopyToClipboard>
                          </div>
                        </div>
                      </div>
                    </li>
                    <li>
                      <div class="rounded-lg border border-slate-300/40 bg-white/80 p-4 shadow-sm">
                        <header class="text-argon-800/60 flex items-center gap-3 text-xl font-semibold">
                          <span
                            class="bg-argon-500 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-white">
                            3
                          </span>
                          Input Your Server's SSH Details
                        </header>
                        <div>
                          <div>
                            <p class="my-3">
                              You'll need to input your server's IP address and SSH user below. The default SSH user for
                              Ubuntu servers is usually
                              <code>ubuntu</code>
                              or
                              <code>root</code>
                              .
                            </p>
                            <div class="flex flex-row items-center">
                              <div class="wrapper mr-2 flex w-1/5 flex-row items-center justify-center">
                                <div v-if="hasSshUserError" class="mb-2 rounded-md bg-red-200 p-2">
                                  <div class="flex">
                                    <div class="shrink-0">
                                      <ExclamationTriangleIcon class="size-5 text-red-400" aria-hidden="true" />
                                    </div>
                                    <div class="ml-3">
                                      <h3 class="text-sm font-medium text-red-800">SSH User cannot be left blank</h3>
                                    </div>
                                  </div>
                                </div>
                                <input
                                  type="text"
                                  v-model="sshUser"
                                  placeholder="SSH User"
                                  class="w-full rounded-md border border-slate-300 bg-white px-4 py-4" />
                                <span class="pl-2 font-bold text-slate-500/60">@</span>
                              </div>
                              <div class="wrapper mr-4 flex grow flex-col">
                                <div v-if="hasIpAddressError" class="mb-2 rounded-md bg-red-200 p-2">
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
                                  v-model="ipAddressAndMaybePort"
                                  placeholder="Your Server's IP Address"
                                  class="w-full rounded-md border border-slate-300 bg-white px-4 py-4" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>
              </TabsContent>

              <TabsContent value="local">
                <div class="mx-5 p-3">
                  <ul Steps class="flex w-full flex-col space-y-6">
                    <li>
                      <div class="rounded-lg border border-slate-300/40 bg-white/80 p-4 shadow-sm">
                        <header class="text-argon-800/60 flex items-center gap-3 text-xl font-semibold">
                          <span
                            class="bg-argon-500 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-white">
                            1
                          </span>
                          Install Docker
                        </header>
                        <div class="flex gap-10 pt-3">
                          <div class="w-1/2">
                            You'll need docker installed on your local machine. The basic requirements are:

                            <div class="mt-3">
                              <a @click="openDockerInstallLink" class="!text-argon-600 cursor-pointer">
                                Click to Install Docker
                              </a>
                              <p class="mt-5 text-lg font-bold text-red-500" v-if="!isDockerStarted">
                                You must install and start Docker to use this option.
                              </p>
                              <p class="mt-5 text-lg font-bold text-red-700/60" v-else-if="needsOpenPorts.length">
                                There are some network ports in use on your machine that need to be freed up:
                                <span class="font-normal">{{ needsOpenPorts.join(', ') }}</span>
                              </p>
                            </div>
                          </div>

                          <div class="w-1/2 rounded-md bg-slate-50/50">
                            <table class="w-full border border-slate-300/40 bg-white/80 p-4 shadow-sm">
                              <tbody>
                                <tr class="border-b border-dashed border-slate-400/20">
                                  <td
                                    class="text-argon-800/60 border-r border-dashed border-slate-400/20 p-2 pr-4 text-right">
                                    Docker Version
                                  </td>
                                  <td class="text-argon-800/80 p-2 pl-4 text-left font-sans font-bold">27+</td>
                                </tr>
                                <tr class="border-b border-dashed border-slate-400/20">
                                  <td
                                    class="text-argon-800/60 border-r border-dashed border-slate-400/20 p-2 pr-4 text-right">
                                    Hard Drive Space
                                  </td>
                                  <td class="text-argon-800/80 p-2 pl-4 font-sans font-bold">100GB or more</td>
                                </tr>
                                <tr class="">
                                  <td
                                    class="text-argon-800/60 border-r border-dashed border-slate-400/20 p-2 text-right">
                                    Computer Sleep
                                  </td>
                                  <td class="text-argon-800/80 p-2 pl-4 font-sans font-bold">
                                    Your Computer Must Stay Awake
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </li>
                    <li>
                      <div class="rounded-lg border border-slate-300/40 bg-white/80 p-4 shadow-sm">
                        <header class="text-argon-800/60 flex items-center gap-3 text-xl font-semibold">
                          <span
                            class="bg-argon-500 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-white">
                            2
                          </span>
                          Your Computer Will Stay Awake
                        </header>
                        <div class="flex gap-10 pt-3">
                          <div class="w-1/2">
                            <strong>NOTE:</strong>
                            Running a Miner and Bidding Bot from your local computer requires your machine to stay awake
                            in order to be available to bid on seats and close blocks.
                            <br />
                            <br />
                            This app will automatically keep your computer from sleeping completely.
                          </div>

                          <div class="w-1/2 rounded-md bg-slate-50/50">
                            <div class="flex items-center gap-2">
                              <label
                                class="text-argon-800/60 pr-2 text-sm leading-none font-bold select-none"
                                for="stay-awake">
                                App Keeps Computer Awake
                              </label>

                              <SwitchRoot
                                id="stay-awake"
                                v-model="setAlwaysOn"
                                :disabled="true"
                                class="border-argon-300 focus-within:border-argon-800 data-[state=checked]:bg-argon-800/40 data-[state=checked]:border-argon-600/40 data-[state=unchecked]:bg-argon-300 relative flex h-[20px] w-[32px] rounded-full border shadow-sm transition-[background] focus-within:shadow-[0_0_0_1px] focus-within:shadow-slate-800 focus-within:outline-none">
                                <SwitchThumb
                                  class="my-auto flex h-3.5 w-3.5 translate-x-0.5 items-center justify-center rounded-full bg-white text-xs shadow-xl transition-transform will-change-transform data-[state=checked]:translate-x-full" />
                              </SwitchRoot>
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  </ul>
                </div>
              </TabsContent>
            </TabsRoot>
            <div class="mx-4 mb-5 flex flex-row justify-end space-x-4 px-4">
              <div v-if="serverDetailsError" class="flex grow items-center rounded-md bg-red-200 p-2 pl-4">
                <div class="flex">
                  <div class="shrink-0">
                    <ExclamationTriangleIcon class="size-5 text-red-400" aria-hidden="true" />
                  </div>
                  <div class="ml-3">
                    <h3 class="text-sm font-medium text-red-800">
                      {{ serverDetailsError }}
                    </h3>
                  </div>
                </div>
              </div>
              <button
                @click="cancelOverlay"
                class="cursor-pointer rounded-md border border-[#A600D4] px-7 py-2 text-xl font-bold text-gray-500">
                <span>Close</span>
              </button>
              <button
                @click="addServer"
                :disabled="!canSubmit()"
                class="rounded-md bg-[#A600D4] px-7 py-2 text-xl font-bold text-white"
                :class="[canSubmit() ? 'cursor-pointer' : 'cursor-normal bg-[#A600D4]/50']">
                <template v-if="selectedTab === 'local'">
                  <span v-if="!isSaving">Add Local Machine</span>
                  <span v-else>Adding Local Machine...</span>
                </template>
                <template v-else>
                  <span v-if="!isSaving">Add Server</span>
                  <span v-else>Adding Server...</span>
                </template>
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import basicEmitter from '../emitters/basicEmitter';
import { useConfig } from '../stores/config';
import { useInstaller } from '../stores/installer';
import BgOverlay from '../components/BgOverlay.vue';
import CopyIcon from '../assets/copy.svg?component';
import { ExclamationTriangleIcon } from '@heroicons/vue/20/solid';
import YoutubeVideo from '../components/YoutubeVideo.vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import CopyToClipboard from '../components/CopyToClipboard.vue';
import { SSH } from '../lib/SSH';
import { IConfigServerDetails, ServerType } from '../interfaces/IConfig';
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  TabsContent,
  TabsIndicator,
  TabsList,
  TabsRoot,
  TabsTrigger,
  SwitchRoot,
  SwitchThumb,
} from 'reka-ui';
import ImageZoom from '../components/ImageZoom.vue';
import { Motion } from 'motion-v';
import { invokeWithTimeout } from '../lib/tauriApi.ts';
import { enable as enableAutostart } from '@tauri-apps/plugin-autostart';
import { platformType } from '../tauri-controls/utils/os.ts';
import { open as tauriOpenUrl } from '@tauri-apps/plugin-shell';
import { LocalMachine } from '../lib/LocalMachine.ts';

const config = useConfig();
const installer = useInstaller();

const sshPublicKey = Vue.computed(() => config.security.sshPublicKey);

const addSshPublicKey = Vue.computed(() => {
  const key = config.security.sshPublicKey.trim();

  return `echo "${key}" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`;
});

const scrollContainer = Vue.ref<HTMLDivElement>();

const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);
const isSaving = Vue.ref(false);

const sshUser = Vue.ref('');
const ipAddressAndMaybePort = Vue.ref(config.serverDetails.ipAddress ?? '');
if (config.serverDetails.port && config.serverDetails.port !== 22) {
  ipAddressAndMaybePort.value = `${ipAddressAndMaybePort.value}:${config.serverDetails.port}`;
}
const hasIpAddressError = Vue.ref(false);
const hasSshUserError = Vue.ref(false);
const serverDetailsError = Vue.ref('');
const selectedTab = Vue.ref('do');
const showDetailedServerInstructions = Vue.ref(false);
const setAlwaysOn = Vue.ref(true);
const copyToClipboard = Vue.ref<typeof CopyToClipboard>();

basicEmitter.on('openServerConnectOverlay', async () => {
  isOpen.value = true;
  isLoaded.value = true;
});

const cancelOverlay = () => {
  isOpen.value = false;
  isLoaded.value = false;
};

function checkIpAddress() {
  if (ipAddressAndMaybePort.value === '') {
    hasIpAddressError.value = true;
    return false;
  }
  return true;
}

function checkSshUser() {
  if (sshUser.value === '') {
    hasSshUserError.value = true;
    return false;
  }
  return true;
}

function canSubmit() {
  if (hasIpAddressError.value) return false;
  if (hasSshUserError.value) return false;
  if (isSaving.value) return false;
  if (selectedTab.value === 'local') {
    if (!isDockerStarted.value) return false;
    if (needsOpenPorts.value.length > 0) return false;
  }
  return true;
}

async function addServer() {
  isSaving.value = true;
  hasIpAddressError.value = false;
  hasSshUserError.value = false;
  serverDetailsError.value = '';

  try {
    let type = ServerType.DigitalOcean;
    if (selectedTab.value === 'do') {
      sshUser.value = 'root';
      if (!checkIpAddress()) {
        return;
      }
    } else if (selectedTab.value === 'custom') {
      type = ServerType.AnyServer;
      if (!checkIpAddress() || !checkSshUser()) {
        return;
      }
    } else if (selectedTab.value === 'local') {
      sshUser.value = 'root';
      type = ServerType.Docker;
    }

    const [ipAddress, maybePort] = ipAddressAndMaybePort.value.split(':');

    const port = maybePort ? parseInt(maybePort.trim(), 10) : 22;
    if (isNaN(port) || port <= 0 || port > 65535) {
      hasIpAddressError.value = true;
      serverDetailsError.value = 'Invalid port number in IP address.';
      isSaving.value = false;
      return;
    }

    const newServerDetails: IConfigServerDetails = {
      ...config.serverDetails,
      ipAddress,
      port,
      sshUser: sshUser.value,
      type,
    };

    if (type === ServerType.Docker) {
      await checkDockerDependencies();
      if (!isDockerStarted.value) {
        serverDetailsError.value = 'You must start Docker before adding your local machine.';
        return;
      }
      if (needsOpenPorts.value.length > 0) {
        serverDetailsError.value = `This local machine requires some network ports that are currently in use by other applications (${String(needsOpenPorts.value.join(', '))}). Please free these ports and try again.`;
        return;
      }
      try {
        const { sshPort } = await LocalMachine.create(sshPublicKey.value);
        newServerDetails.ipAddress = `127.0.0.1`;
        newServerDetails.port = sshPort;
        newServerDetails.workDir = '/app';
      } catch (err) {
        serverDetailsError.value = `Something went wrong trying to create your local Docker server. Try restarting Docker.`;
        console.error(`Error creating local docker machine`, err);
        return;
      }
    }

    try {
      const serverMeta = await SSH.tryConnection(newServerDetails, config.security.sshPrivateKeyPath);
      if (serverMeta.walletAddress && serverMeta.walletAddress !== config.miningAccount.address) {
        serverDetailsError.value = 'This server has a different wallet address than your mining account.';
        return;
      }
    } catch (err) {
      console.error('Error connecting to server', err);
      if (type === ServerType.Docker) {
        serverDetailsError.value = `Failed to connect to your local Docker server. Try restarting docker.`;
        return;
      } else {
        serverDetailsError.value = `Failed to connect to server. Please ensure you used the correct Public Key.`;
      }
      return;
    }
    config.serverDetails = newServerDetails;
    await config.save();
    if (type === ServerType.Docker) {
      await invokeWithTimeout('toggle_nosleep', { enable: true }, 5000);
      await enableAutostart();
    }
    cancelOverlay();
  } catch (error) {
    serverDetailsError.value = `An unknown error occurred connecting to this machine: ${String(error)}`;
  } finally {
    isSaving.value = false;
    if (hasIpAddressError.value || hasSshUserError.value) {
      scrollContainer.value?.scrollTo({ top: scrollContainer.value.scrollHeight, behavior: 'smooth' });
    }
  }
}

function openDockerInstallLink() {
  const install = {
    gnome: 'linux',
    macos: 'mac-install',
    windows: 'windows-install',
  }[platformType];
  const url = `https://docs.docker.com/desktop/setup/install/${install}/`;
  void tauriOpenUrl(url);
}

function openDigitalOceanLink() {
  void tauriOpenUrl('https://www.digitalocean.com#start-building-today');
}

function highlightCopiedContent() {
  const wrapperElem = copyToClipboard.value?.$el;
  if (!wrapperElem) return;

  const inputElem = wrapperElem.querySelector('input') as HTMLInputElement;
  inputElem.select();
}

const isDockerStarted = Vue.ref(false);
const needsOpenPorts = Vue.ref([] as number[]);
let checkDockerInterval: number | undefined;

async function checkDockerDependencies() {
  if (checkDockerInterval) clearTimeout(checkDockerInterval);
  try {
    isDockerStarted.value = await LocalMachine.isDockerRunning();
  } catch (e) {
    // no action
  }

  // check for blocked ports
  try {
    needsOpenPorts.value = await LocalMachine.checkBlockedPorts();
  } catch (e) {
    // no action
  }
  if (selectedTab.value === 'local' && (!isDockerStarted.value || needsOpenPorts.value.length > 0)) {
    checkDockerInterval = setTimeout(checkDockerDependencies, 1000) as unknown as number;
  }
}

Vue.watch(selectedTab, async tab => {
  if (tab === 'local') {
    void checkDockerDependencies();
  } else {
    if (checkDockerInterval) clearTimeout(checkDockerInterval);
  }
});
Vue.onMounted(() => {
  if (selectedTab.value === 'local') {
    void checkDockerDependencies();
  }
});
</script>

<style scoped>
@reference "../main.css";

.ConnectOverlay {
  h2 {
    position: relative;
    &:before {
      @apply from-argon-menu-bg bg-gradient-to-r to-transparent;
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
      @apply from-argon-menu-bg bg-gradient-to-l to-transparent;
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
  ul[Steps] {
    > li {
      @apply mb-5 flex flex-col gap-2;
    }
    header {
      @apply text-lg font-bold;
    }
    [wrapper] {
      @apply flex flex-row items-start gap-x-10;
      & > div {
        @apply w-2/3;
      }
    }
    p {
      @apply mb-3;
    }
    td {
      @apply pb-2;
    }
  }
}
</style>
