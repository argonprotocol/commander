<!-- prettier-ignore -->
<template>
  <div data-testid="Dashboard" class="flex flex-col h-full">
    <div class="flex flex-col h-full px-2.5 py-2.5 gap-y-2 justify-stretch grow">
      <section box class="flex flex-row items-center min-h-[6%] text-slate-900/90">
        <div v-if="isUpdatingVault || updateVaultErrorMessage" class="px-6 text-md font-thin text-center w-full">
          <span v-if="updateVaultErrorMessage" class="text-red-700 font-bold text-md">{{ updateVaultErrorMessage }}</span>
          <div v-else class="flex flex-row items-center text-gray-500 w-full whitespace-nowrap">
            <span class="mr-2">Updating Vault</span>
            <ProgressBar
              :hasError="updateVaultErrorMessage != ''"
              :progress="updateVaultProgressPct"
            />
          </div>
        </div>
        <div v-else-if="vault.data.pendingCollectRevenue" class="px-6 py-2 flex flex-row items-center w-full h-full">
          <div class="flex flex-row items-center text-xl relative text-slate-800/90">
            <MoneyIcon class="h-10 w-10 inline-block mr-4 relative top-1 text-argon-800/60" />
            <strong>{{ currency.symbol }}{{ microgonToMoneyNm(vault.data.pendingCollectRevenue).formatIfElse('< 1_000', '0,0.00', '0,0') }} is waiting to be collected</strong>&nbsp;(expires in&nbsp;
            <CountdownClock :time="nextCollectDueDate" v-slot="{ hours, minutes, days }">
              <span v-if="days > 0">{{ days }} day{{ days === 1 ? '' : 's' }} </span>
              <template v-else>
                <span class="mr-2" v-if="hours">{{ hours }} hour{{ hours === 1 ? '' : 's' }} </span>
                <span v-if="minutes">{{ minutes }} minute{{ minutes === 1 ? '' : 's' }}</span>
              </template>
            </CountdownClock>)
          </div>
          <div class="grow flex flex-row items-center pl-2 pr-3">
            <div class="h-4 w-full bg-gradient-to-r from-transparent to-argon-700/10"></div>
            <div class="flex items-center justify-center">
              <svg viewBox="7 5 5 10" fill="currentColor" class="text-argon-700/10 h-7" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 5l5 5-5 5" fill="currentColor" />
              </svg>
            </div>
          </div>
          <button @click="showCollectOverlay = true" class="bg-white border border-argon-600/20 hover:bg-argon-600/10 inner-button-shadow cursor-pointer rounded-md px-8 py-2 font-bold text-argon-600 focus:outline-none">
            Collect Revenue
          </button>
        </div>
        <div v-else-if="vault.data.pendingCosignUtxoIds.size" class="px-6 py-2 flex flex-row items-center w-full h-full">
          <div class="flex flex-row items-center text-lg relative text-slate-800/90">
            <SigningIcon class="h-10 w-10 inline-block mr-4 relative text-argon-800/60" />
            <strong>{{vault.data.pendingCosignUtxoIds.size || 2}} bitcoin transaction{{vault.data.pendingCosignUtxoIds.size === 1 ? '' : 's'}} require signing at a penalty of {{ currency.symbol }}{{ microgonToMoneyNm(vault.data.pendingCollectRevenue).formatIfElse('< 1_000', '0,0.00', '0,0') }}</strong>&nbsp;(expires in&nbsp;
            <CountdownClock :time="nextCollectDueDate" v-slot="{ hours, minutes, days }">
              <span v-if="days > 0">{{ days }} day{{ days === 1 ? '' : 's' }} </span>
              <template v-else>
                <span class="mr-2" v-if="hours">{{ hours }} hour{{ hours === 1 ? '' : 's' }} </span>
                <span v-if="minutes">{{ minutes }} minute{{ minutes === 1 ? '' : 's' }}</span>
              </template>
            </CountdownClock>)
          </div>
          <div class="grow flex flex-row items-center pl-2 pr-3">
            <div class="h-4 w-full bg-gradient-to-r from-transparent to-argon-700/10"></div>
            <div class="flex items-center justify-center">
              <svg viewBox="7 5 5 10" fill="currentColor" class="text-argon-700/10 h-7" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 5l5 5-5 5" fill="currentColor" />
              </svg>
            </div>
          </div>
          <button @click="showCollectOverlay = true" class="bg-white border border-argon-600/20 hover:bg-argon-600/10 inner-button-shadow cursor-pointer rounded-md px-8 py-2 font-bold text-argon-600 focus:outline-none">
            Sign Bitcoin Transactions
          </button>
        </div>
        <div v-else class="flex flex-row px-3 items-center w-full h-full">
          <SuccessIcon class="w-10 h-10 text-argon-600 mr-4 relative opacity-80" />
          <div class="opacity-60 relative top-px">Your vault is operational and in good order!</div>
        </div>
      </section>

      <section class="flex flex-row gap-x-2 h-[14%]">
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>
            {{ currency.symbol }}{{ microgonToMoneyNm(vault.createdVault!.activatedSecuritization()).formatIfElse('< 1_000', '0,0.00', '0,0') }}
          </span>
          <label>Total Bitcoin Locked</label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span class="flex flex-row items-center justify-center space-x-3">
            <span>{{ numeral(rules.securitizationRatio).format('0.[00]') }}</span>
            <span class="!font-light">to</span>
            <span>1</span>
          </span>
          <label>Securitization Ratio</label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>{{ currency.symbol}}0.00</span>
          <label>External Treasury Bonds</label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>
            {{ currency.symbol}}{{ microgonToMoneyNm(ownTreasuryPoolCapitalDeployed).formatIfElse('< 1_000', '0,0.00', '0,0') }}
          </span>
          <label>Total Treasury Bonds</label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>{{ currency.symbol }}{{ microgonToMoneyNm(revenueMicrogons).formatIfElse('< 1_000', '0,0.00', '0,0') }}</span>
          <label>Relative Total Earnings</label>
        </div>
        <div box stat-box class="flex flex-col w-2/12 !py-4">
          <span>{{ numeral(apy).formatIfElseCapped('< 100', '0,0.[00]', '0,0', 9_999) }}%</span>
          <label>Current APY</label>
        </div>
      </section>

      <section class="flex flex-row gap-x-2.5 grow">
        <div box class="flex flex-col w-[22.5%] px-2">
          <header class="text-[18px] font-bold py-2 text-slate-900/80 border-b border-slate-400/30">
            Asset Breakdown
          </header>
          <ul class="relative flex flex-col items-center whitespace-nowrap w-full min-h-6/12 mb-4 text-md">
            <li class="flex flex-col w-full min-h-[calc(100%/7)] py-2">
              <div class="flex flex-row items-center w-full">
                <ArgonIcon class="w-7 h-7 text-argon-600/70 mr-2" />
                <div class="grow">Unused Argons</div>
                <div class="pr-1">
                  {{ currency.symbol
                  }}{{ microgonToMoneyNm(wallets.vaultingWallet.availableMicrogons).format('0,0.00') }}
                </div>
              </div>
              <div class="flex flex-col ml-9 gap-y-1 text-slate-900/60">
                <div class="border-t border-gray-600/20 border-dashed pt-2 relative">
                  <ArrowTurnDownRightIcon class="w-5 h-5 text-slate-600/40 absolute top-1/2 -translate-y-1/2 -translate-x-[130%] left-0" />
                  {{ numeral(wallets.vaultingWallet.availableMicrogons).formatIfElse('< 100', '0,0.[00]', '0,0') }} Not Allocated
                </div>
                <div class="border-t border-gray-600/20 border-dashed pt-2 relative">
                  <ArrowTurnDownRightIcon class="w-5 h-5 text-slate-600/40 absolute top-1/2 -translate-y-1/2 -translate-x-[130%] left-0" />
                  0 Waiting to Mint
                </div>
              </div>
            </li>
            <li class="flex flex-col w-full border-t border-gray-600/20 border-dashed py-2">
              <div class="flex flex-row items-center w-full">
                <ArgonotIcon class="w-7 h-7 text-argon-600/70 mr-2" />
                <div class="grow">Bitcoin Security</div>
                <div class="pr-1">
                  {{ currency.symbol
                  }}{{ micronotToMoneyNm(activatedSecuritization + pendingSecuritization).format('0,0.00') }}
                </div>
              </div>
              <div class="flex flex-col ml-9 gap-y-1 text-slate-900/60">
                <div class="border-t border-gray-600/20 border-dashed pt-2 relative">
                  <ArrowTurnDownRightIcon class="w-5 h-5 text-slate-600/40 absolute top-1/2 -translate-y-1/2 -translate-x-[130%] left-0" />
                  {{ microgonToArgonNm(activatedSecuritization).format('0,0.[00]') }} Argons Used
                </div>
                <div class="border-t border-gray-600/20 border-dashed pt-2 relative">
                  <ArrowTurnDownRightIcon class="w-5 h-5 text-slate-600/40 absolute top-1/2 -translate-y-1/2 -translate-x-[130%] left-0" />
                  {{ microgonToArgonNm(pendingSecuritization).format('0,0.[00]') }} Waiting to Use
                </div>
              </div>
            </li>
            <li class="flex flex-col w-full border-t border-gray-600/20 border-dashed py-2">
              <div class="flex flex-row items-center w-full">
                <ArgonotIcon class="w-7 h-7 text-argon-600/70 mr-2" />
                <div class="grow">Treasury Bonds</div>
                <div class="pr-1">
                  {{ currency.symbol
                  }}{{ micronotToMoneyNm(ownTreasuryPoolCapitalDeployed + pendingTreasuryPool).format('0,0.00') }}
                </div>
              </div>
              <div class="flex flex-col ml-9 gap-y-1 text-slate-900/60">
                <div class="border-t border-gray-600/20 border-dashed pt-2 relative">
                  <ArrowTurnDownRightIcon class="w-5 h-5 text-slate-600/40 absolute top-1/2 -translate-y-1/2 -translate-x-[130%] left-0" />
                  {{ microgonToArgonNm(ownTreasuryPoolCapitalDeployed).format('0,0.[00]') }} Argons Used
                </div>
                <div class="border-t border-gray-600/20 border-dashed pt-2 relative">
                  <ArrowTurnDownRightIcon class="w-5 h-5 text-slate-600/40 absolute top-1/2 -translate-y-1/2 -translate-x-[130%] left-0" />
                  {{ microgonToArgonNm(pendingTreasuryPool).format('0,0.[00]') }} Waiting to Use
                </div>
              </div>
            </li>
            <li class="flex flex-row items-center w-full  border-t border-gray-600/50 py-2 text-red-900/70">
              <div class="grow pl-1"><span class="hidden xl:inline">Cost to</span> Unlock Bitcoin</div>
              <div class="pr-1">
                -{{ currency.symbol
                }}{{ microgonToMoneyNm(costToRelease).format('0,0.[00]') }}
              </div>
            </li>
            <li class="flex flex-row items-center w-full border-t border-gray-600/20 border-dashed py-2 text-red-900/70">
              <div class="grow pl-1"><span class="hidden xl:inline">Operational</span> Expenses</div>
              <div class="pr-1">
                -{{ currency.symbol
                }}{{ microgonToMoneyNm(vault.metadata?.operationalFeeMicrogons ?? 0n).format('0,0.00') }}
              </div>
            </li>
            <li class="flex flex-row items-center justify-between w-full border-t border-b border-gray-600/50 py-2 font-bold">
              <div class="grow pl-1">Total Value</div>
              <div class="pr-1">
                {{ currency.symbol
                }}{{ microgonToMoneyNm(wallets.totalVaultingResources - (costToRelease + vault.data.pendingCollectRevenue)).format('0,0.00') }}
              </div>
            </li>
          </ul>
          <div class="grow flex flex-col items-center justify-end">
            <div @click="openVaultOverlay" class="relative text-center mb-5 text-argon-600 opacity-70 hover:opacity-100 cursor-pointer">
              <VaultIcon class="w-20 h-20 mt-5 inline-block mb-3" />
              <div>Configure Vault</div>
            </div>
          </div>
        </div>

        <div class="flex flex-col grow gap-y-2">
          <section class="flex flex-col">
            <div v-if="personalUtxo?.status === 'initialized'" class="grow flex flex-row items-center justify-start px-[5%] py-2 border-2 border-dashed border-slate-900/30 m-0.5">
              <BitcoinIcon class="w-20 h-20 inline-block mr-5 -rotate-24" />
              <div class="flex flex-col items-start justify-center grow">
                <div class="text-xl font-bold opacity-60">{{ numeral(currency.satsToBtc(personalUtxo?.satoshis ?? 0n)).format('0,0.[00000000]') }}</div>
                <div>Personal Bitcoin In Process of Locking</div>
                <div class="opacity-40">
                  {{ currency.symbol }}{{ microgonToMoneyNm(btcMarketRate).format('0,0.[00]') }} Value
                  /
                  {{ currency.symbol}}{{ microgonToMoneyNm(personalUtxo?.liquidityPromised ?? 0n).format('0,0.[00]') }} Liquidity
                </div>
              </div>
              <div class="flex flex-col items-center justify-center">
                <button @click="showCompleteLockOverlay = true" class="bg-argon-600 text-white text-lg font-bold px-4 py-2 rounded-md cursor-pointer">Finish Locking</button>
                <div class="opacity-40 italic mt-1">Expires in 27 hrs</div>
              </div>
            </div>
            <div v-else-if="personalUtxo?.status !== 'released'" box class="grow flex flex-row items-center justify-start pl-[5%] pr-[3%] !py-5">
              <BitcoinIcon class="w-20 h-20 inline-block mr-5 -rotate-24 opacity-60" />
              <div class="flex flex-col items-start justify-center grow">
                <div class="text-xl font-bold opacity-60">{{ numeral(currency.satsToBtc(personalUtxo?.satoshis ?? 0n)).format('0,0.[00000000]') }} ({{ currency.symbol }}{{ microgonToMoneyNm(btcMarketRate).format('0,0.[00]') }})</div>
                <div>Personal Bitcoin Locked</div>
                <div class="opacity-40">
                  {{ currency.symbol}}{{ microgonToMoneyNm(personalUtxo?.liquidityPromised ?? 0n).format('0,0.[00]') }} Liquidity
                  /
                  {{ currency.symbol }}{{ microgonToMoneyNm(costToRelease).format('0,0.[00]') }} To Unlock
                </div>
              </div>
              <div class="flex flex-col gap-x-3 xl:flex-row-reverse items-center justify-center whitespace-nowrap">
                <div class="flex flex-row space-x-2 items-center justify-center">
                  <button @click="showReleaseOverlay=true" class="bg-argon-600 hover:bg-argon-700 text-white text-lg font-bold px-4 py-2 rounded-md cursor-pointer">Unlock Bitcoin</button>
                  <!-- <span class="opacity-40">or</span>
                  <button class="bg-argon-600 hover:bg-argon-700 text-white text-lg font-bold px-4 py-2 rounded-md cursor-pointer">Ratchet</button> -->
                </div>
                <div class="opacity-40 italic mt-1">
                  Expires in
                  <CountdownClock :time="lockExpirationTime" v-slot="{ hours, minutes, days }">
                    <template v-if="days === 0">
                      {{ hours }}h {{ minutes }}m
                    </template>
                    <template v-else>
                      {{ days }} Day{{ days > 1 ? 's' : '' }}
                    </template>
                  </CountdownClock>
                </div>
              </div>
            </div>
            <div v-else class="grow flex flex-row items-center justify-start px-[5%] py-2 border-2 border-dashed border-slate-900/30 m-0.5">
              <BitcoinIcon class="w-20 h-20 inline-block mr-5 -rotate-24" />
              <div class="flex flex-col items-start justify-center grow">
                <div class="text-xl font-bold opacity-60">{{ numeral(currency.satsToBtc(0n)).format('0,0.[00000000]') }}</div>
                <div>No Bitcoin In Process of Locking</div>

              </div>
              <div class="flex flex-col items-center justify-center">
                <button class="bg-argon-600 text-white text-lg font-bold px-4 py-2 rounded-md cursor-pointer">Configure Locking</button>

              </div>
            </div>
          </section>

          <section box class="flex flex-col grow text-center px-2 min-h-[55%]">
            <header class="flex flex-row justify-between text-xl font-bold py-2 text-slate-900/80 border-b border-slate-400/30">
              <div @click="goToPrevFrame" :class="hasPrevFrame ? 'opacity-60' : 'opacity-20 pointer-events-none'" class="flex flex-row items-center font-light text-base cursor-pointer group hover:opacity-80">
                <ChevronLeftIcon class="w-6 h-6 opacity-50 mx-1 group-hover:opacity-80" />
                PREV
              </div>
              <span class="flex flex-row items-center" :title="'Frame #' + currentFrame?.id">
                <span>{{ currentFrameStartDate }} to {{ currentFrameEndDate }}</span>
                <span v-if="currentFrame?.id > stats.latestFrameId - 10" class="inline-block rounded-full bg-green-500/80 w-2.5 h-2.5 ml-2"></span>
              </span>
              <div @click="goToNextFrame" :class="hasNextFrame ? 'opacity-60' : 'opacity-20 pointer-events-none'" class="flex flex-row items-center font-light text-base cursor-pointer group hover:opacity-80">
                NEXT
                <ChevronRightIcon class="w-6 h-6 opacity-50 mx-1 group-hover:opacity-80" />
              </div>
            </header>

            <div class="grow flex flex-col items-center justify-center">
              <div class="pt-5 border-b border-slate-400/20 pb-5 w-full text-slate-800/70">
                This frame's payout is
                <span class="font-bold text-argon-600 font-mono">{{ currency.symbol }}{{ microgonToMoneyNm(currentFrame.totalTreasuryPayout).format('0,0.00') }}</span> (and growing),
                of which your take is <span class="font-bold text-argon-600 font-mono">0%</span>,
                equaling <span class="font-bold text-argon-600 font-mono">{{ currency.symbol }}{{ microgonToMoneyNm(currentFrame.myTreasuryPayout).format('0,0.00') }}</span> <span class="hidden lg:inline">in earnings</span>
              </div>

              <div class="flex flex-row w-full grow gap-x-2 mt-2">
                <div stat-box class="flex flex-col w-1/3 h-full">
                  <div class="relative size-28">
                    <svg class="size-full -rotate-90" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="18" cy="18" r="16" fill="none" class="stroke-current text-gray-200 dark:text-neutral-700" stroke-width="3"></circle>
                      <circle cx="18" cy="18" r="16" fill="none" class="stroke-current text-argon-600 dark:text-argon-500" stroke-width="3" stroke-dasharray="100" :stroke-dashoffset="100-currentFrame.progress" stroke-linecap="butt"></circle>
                    </svg>

                    <div class="absolute top-1/2 start-1/2 transform -translate-y-1/2 -translate-x-1/2">
                      <span class="text-center !text-[30px] font-bold text-argon-600 dark:text-argon-500">{{ Math.round(currentFrame.progress) }}%</span>
                    </div>
                  </div>
                </div>

                <div class="h-full w-[1px] bg-slate-400/30"></div>

                <div stat-box class="flex flex-col w-1/3 h-full pb-3">
                  <span data-testid="TotalBlocksMined">{{ currency.symbol }}0.00</span>
                  <label class="relative block w-full">
                    Bitcoin Lock Change
                    <HealthIndicatorBar :percent="getPercent(100, 100)" />
                  </label>
                </div>

                <div class="h-full w-[1px] bg-slate-400/30"></div>

                <div stat-box class="flex flex-col w-1/3 h-full pb-3">
                  <span data-testid="TotalBlocksMined">{{ currency.symbol }}0.00</span>
                  <label class="relative block w-full">
                    Treasury Bond Change
                    <HealthIndicatorBar :percent="getPercent(0, 100)" />
                  </label>
                </div>

                <div class="h-full w-[1px] bg-slate-400/30"></div>

                <div stat-box class="flex flex-col w-1/3 h-full pb-3">
                  <span data-testid="TotalBlocksMined">0%</span>
                  <label class="relative block w-full">
                    Current Frame Profit
                    <HealthIndicatorBar :percent="getPercent(0, 100)" />
                  </label>
                </div>

              </div>
            </div>
          </section>

          <section box class="relative flex flex-col h-[35%] min-h-32 !pb-0.5 px-2">
            <FrameSlider ref="frameSliderRef" :chartItems="chartItems" @changedFrame="updateSliderFrame" />
          </section>
        </div>
      </section>

      <!-- Personal Bitcoin panel -->
      <!-- <div box class="flex flex-col items-center p-6" :class="[ personalUtxo ? '' : 'border-dashed border-2']">
        <h2 class="text-3x font-bold text-gray-600 text-left">Personal Bitcoin</h2>
        <div class="grid grid-cols-5 gap-4 items-center py-4" v-if="personalUtxo">
          <div stat-box class="flex flex-col text-center">
            <span
              class="text-2xl font-bold">{{ numeral(currency.satsToBtc(personalUtxo.satoshis)).format('0,0.[00000000]') }} BTC</span>
            <div class="text-gray-500 text-sm">Market Value = {{ currency.symbol }}{{ microgonToMoneyNm(btcMarketRate).format('0,0.[00]') }}
            </div>
          </div>
          <div stat-box class="flex flex-col text-center">
            <span class="text-2xl font-bold" :class="[personalUtxo.status === 'initialized'? 'text-gray-500': '']">{{ currency.symbol
              }}{{ microgonToMoneyNm(personalUtxo.liquidityPromised).format('0,0.[00]') }}</span>
            <label v-if="personalUtxo.status === 'initialized'">Liquidity Promised</label>
            <label v-else>Liquidity Unlocked</label>
            <div v-if="personalUtxo.status === 'initialized' && bitcoinPendingStatus" class="text-sm text-gray-400">({{bitcoinPendingStatus}})</div>
          </div>
          <template v-if="personalUtxo.status === 'initialized'">
            <div stat-box class="text-center flex-flex-col">
              <CountdownClock :time="lockInitializeExpirationTime" v-slot="{ days, hours, minutes }">
                <template v-if="days > 0">
                  <span class="text-2xl font-bold">{{ days }} Days</span>
                </template>
                <template v-else>
                  <span class="text-2xl font-bold">{{ hours }}h {{ minutes }}m</span>
                </template>
              </CountdownClock>
              <label>Bitcoin Funding Due By</label>
            </div>
            <div stat-box class="text-center col-span-2 flex-flex-col">
              <span class="text-2xl font-normal"><button class="px-4 py-2 rounded bg-purple-600 text-white"
                                                         @click="showCompleteLockOverlay = true">Transfer BTC</button></span>
              <label>To Unlock your Liquidity</label>
            </div>
          </template>
          <template v-else-if="personalUtxo.status !== 'released'">
            <div stat-box class="text-center">
              <span class="text-2xl font-bold">{{ numeral(mintPercent).format('0,0.[0]') }}%</span>
              <label>Minted</label>
            </div>
            <div stat-box class="text-center">
              <CountdownClock :time="lockExpirationTime" v-slot="{ hours, minutes, days }">
                <template v-if="days === 0">
                  <span class="text-2xl font-bold">{{ hours }}h {{ minutes }}m</span>
                </template>
                <template v-else>
                    <span class="text-2xl font-bold">{{ days }} Day{{ days > 1 ? 's' : '' }}</span>
                </template>
              </CountdownClock>

              <label>Expires In</label>
            </div>
            <div stat-box class="text-center">
              <button class="px-4 py-2 rounded bg-purple-600 text-white" @click="showReleaseOverlay=true">Release
              </button>
            </div>
          </template>
          <template v-else >
            <div stat-box class="text-right col-span-3">
              <span class="text-md text-fuchsia-800 border-2 border-y-fuchsia-800 p-4 border-dashed opacity-40">Released</span>
            </div>
          </template>
        </div>
        <div v-else-if="!vaultingRules.personalBtcPct" class="text-2xl font-bold text-center">
          Configure a personal bitcoin amount to active your Vault's Treasury Pools
        </div>
        <div v-else class="text-md font-bold text-gray-400 text-center">
          Initializing your personal bitcoin lock...
        </div>
      </div> -->

    </div>
  </div>

  <!-- Overlays -->
  <BitcoinLockCompleteOverlay
    v-if="showCompleteLockOverlay && personalUtxo"
    :lock="personalUtxo"
    @close="showCompleteLockOverlay = false"
  />

  <BitcoinReleaseOverlay
    v-if="showReleaseOverlay && personalUtxo"
    :lock="personalUtxo"
    @close="showReleaseOverlay = false"
  />

  <VaultCollectOverlay
    v-if="showCollectOverlay"
    @close="showCollectOverlay = false"
  />
</template>

<script lang="ts">
const currentFrame = Vue.ref({
  id: 0,
  date: '',
  firstTick: 0,
  lastTick: 0,
  score: 0,
  progress: 0,
  totalTreasuryPayout: 0n,
  myTreasuryPayout: 0n,
});

const sliderFrameIndex = Vue.ref(0);
</script>

<script setup lang="ts">
import * as Vue from 'vue';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import { useCurrency } from '../../stores/currency';
import numeral, { createNumeralHelpers } from '../../lib/numeral';
import { useMyVault, useVaults } from '../../stores/vaults.ts';
import { useConfig } from '../../stores/config.ts';
import { MyVault } from '../../lib/MyVault.ts';
import CountdownClock from '../../components/CountdownClock.vue';
import { useBitcoinLocks } from '../../stores/bitcoin.ts';
import ArgonIcon from '../../assets/resources/argon.svg?component';
import ArgonotIcon from '../../assets/resources/argonot.svg?component';
import ArgonotLockedIcon from '../../assets/resources/argonot-locked.svg?component';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/24/outline';
import { TICK_MILLIS } from '../../lib/Env.ts';
import BitcoinLockCompleteOverlay from '../../overlays/BitcoinLockCompleteOverlay.vue';
import BitcoinReleaseOverlay from '../../overlays/BitcoinReleaseOverlay.vue';
import VaultCollectOverlay from '../../overlays/VaultCollectOverlay.vue';
import SigningIcon from '../../assets/signing.svg?component';
import MoneyIcon from '../../assets/money.svg?component';
import { useWallets } from '../../stores/wallets';
import basicEmitter from '../../emitters/basicEmitter';
import FrameSlider, { IChartItem } from '../../components/FrameSlider.vue';
import { useStats } from '../../stores/stats';
import BitcoinIcon from '../../assets/wallets/bitcoin.svg?component';
import SuccessIcon from '../../assets/success.svg?component';
import VaultIcon from '../../assets/vault.svg?component';
import HealthIndicatorBar from '../../components/HealthIndicatorBar.vue';
import BigNumber from 'bignumber.js';
import { MiningFrames } from '@argonprotocol/commander-core';
import { bigIntMin } from '@argonprotocol/commander-core/src/utils.ts';
import ProgressBar from '../../components/ProgressBar.vue';
import { ArrowTurnDownRightIcon } from '@heroicons/vue/24/outline';

dayjs.extend(relativeTime);
dayjs.extend(utc);

const vault = useMyVault();
const vaults = useVaults();
const wallets = useWallets();
const bitcoinLocks = useBitcoinLocks();
const config = useConfig();
const currency = useCurrency();
const stats = useStats();

const rules = config.vaultingRules;

interface IFrameRecord {
  id: number;
  date: string;
  firstTick: number;
  lastTick: number;
  score: number;
  progress: number;
  totalTreasuryPayout: bigint;
  myTreasuryPayout: bigint;
}

const frameSliderRef = Vue.ref<InstanceType<typeof FrameSlider> | null>(null);
const frameRecords = Vue.ref<IFrameRecord[]>([]);
const chartItems = Vue.ref<IChartItem[]>([]);

const { microgonToMoneyNm, micronotToMoneyNm, microgonToArgonNm } = createNumeralHelpers(currency);

// For the Vault UI countdown clock
const nextCollectDueDate = Vue.computed(() => {
  return dayjs(vault.data.nextCollectDueDate);
});

const personalUtxo = Vue.computed(() => {
  const utxoId = vault.metadata?.personalUtxoId;
  if (!utxoId) return null;
  return bitcoinLocks.data.locksById[utxoId];
});

Vue.watch(personalUtxo, async () => {
  const utxo = personalUtxo.value;
  if (!utxo) return;
  bitcoinLocks.confirmAddress(utxo);
  bitcoinLocks.load().then(() => {
    lockInitializeExpirationTime.value = dayjs(bitcoinLocks.verifyExpirationTime(utxo));
  });
  btcMarketRate.value = await vaults.getMarketRate(personalUtxo.value.satoshis).catch(() => 0n);
});

const lockInitializeExpirationTime = Vue.ref(dayjs().add(1, 'day'));
const lockExpirationTime = Vue.ref(dayjs());

function updateLockExpiration() {
  if (personalUtxo.value) {
    const utxo = personalUtxo.value;
    bitcoinLocks.load().then(() => {
      const expirationMillis = bitcoinLocks.approximateExpirationTime(utxo);
      lockExpirationTime.value = dayjs(expirationMillis);
    });
  }
}

const btcMarketRate = Vue.ref(0n);

const costToRelease = Vue.computed(() => {
  return bigIntMin(personalUtxo.value?.peggedPrice ?? 0n, btcMarketRate.value);
}) as Vue.ComputedRef<bigint>;

const mintPercent = Vue.computed(() => {
  const utxo = personalUtxo.value;
  if (!utxo) return 0n;
  const { mintAmount, mintPending } = utxo.ratchets[0];
  if (mintPending === 0n) return 100;
  return (100 * Number(mintAmount - mintPending)) / Number(mintAmount);
});

const vaultCapital = Vue.computed(() => {
  const { microgonsForVaulting } = MyVault.getMicrogoonSplit(config.vaultingRules);
  return microgonsForVaulting;
});

const activatedSecuritization = Vue.computed(() => {
  return vault.createdVault?.activatedSecuritization() ?? 0n;
});

const pendingSecuritization = Vue.computed(() => {
  const { microgonsForSecuritization } = MyVault.getMicrogoonSplit(config.vaultingRules);
  return microgonsForSecuritization - (vault.createdVault?.activatedSecuritization() ?? 0n);
});

const ownTreasuryPoolCapitalDeployed = Vue.computed(() => {
  const treasuryPool = vault.data.stats;
  if (!treasuryPool) return 0n;
  return treasuryPool.changesByFrame
    .slice(0, 10)
    .reduce((acc, change) => acc + (change.treasuryPool.vaultCapital ?? 0n), 0n);
});

const pendingTreasuryPool = Vue.computed(() => {
  const { microgonsForTreasury } = MyVault.getMicrogoonSplit(config.vaultingRules);
  return microgonsForTreasury - ownTreasuryPoolCapitalDeployed.value;
});

const capitalInUse = Vue.computed(() => {
  return activatedSecuritization.value + ownTreasuryPoolCapitalDeployed.value;
});

const apy = Vue.computed(() => {
  const stats = vault.data.stats;
  if (!stats) return 0;
  let ytdRevenue = 0n;
  const capitalDeployed: bigint[] = [];
  let framesRemaining = 365; // Assuming 365 frames for a year
  for (const change of stats.changesByFrame) {
    ytdRevenue += change.bitcoinFeeRevenue;
    ytdRevenue += change.treasuryPool.vaultEarnings;
    capitalDeployed.push(change.securitization + change.treasuryPool.vaultCapital);
    framesRemaining -= 1;
    if (framesRemaining <= 0) break;
  }
  console.log({ ytdRevenue, capitalDeployed });
  if (framesRemaining > 0) {
    ytdRevenue += stats.baseline.feeRevenue;
  }
  const averageCapitalDeployed =
    capitalDeployed.reduce((acc, val) => acc + val, 0n) / BigInt(capitalDeployed.length || 1);
  return (Number(ytdRevenue) * 100) / Number(averageCapitalDeployed);
});

const revenueMicrogons = Vue.computed(() => {
  const stats = vault.data.stats;
  if (!stats) return 0n;
  let sum = stats.baseline.feeRevenue ?? 0n;
  for (const change of stats.changesByFrame) {
    sum += change.bitcoinFeeRevenue ?? 0n;
    sum += change.treasuryPool.vaultEarnings ?? 0n;
  }
  return sum;
});

const bitcoinTransactions = Vue.computed(() => {
  const stats = vault.data.stats;
  if (!stats) return 0;
  let sum = stats.baseline.bitcoinLocks ?? 0;
  for (const change of stats.changesByFrame) {
    sum += change.bitcoinLocksCreated ?? 0;
  }
  return sum;
});

const showCompleteLockOverlay = Vue.ref(false);
const showReleaseOverlay = Vue.ref(false);
const showCollectOverlay = Vue.ref(false);

const vaultingRules = config.vaultingRules;
const isUpdatingVault = Vue.ref(false);
const updateVaultErrorMessage = Vue.ref('');
const updateVaultProgressPct = Vue.ref(0); // 0-100

const hasNextFrame = Vue.computed(() => {
  return sliderFrameIndex.value < frameRecords.value.length - 1;
});

const hasPrevFrame = Vue.computed(() => {
  return sliderFrameIndex.value > 0;
});

function goToPrevFrame() {
  frameSliderRef.value?.goToPrevFrame();
}

function goToNextFrame() {
  frameSliderRef.value?.goToNextFrame();
}

function updateSliderFrame(newFrameIndex: number) {
  sliderFrameIndex.value = newFrameIndex;
  console.log('NEW FRAME INDEX', newFrameIndex, frameRecords.value[newFrameIndex]);
  currentFrame.value = frameRecords.value[newFrameIndex];
}

function getPercent(value: bigint | number, total: bigint | number): number {
  if (total === 0n || total === 0) return 0;
  return BigNumber(value).dividedBy(total).multipliedBy(100).toNumber();
}

const currentFrameStartDate = Vue.computed(() => {
  if (!currentFrame.value.firstTick) {
    console.log('currentFrame', currentFrame.value);
    return '-----';
  }
  const date = dayjs.utc(currentFrame.value.firstTick * TICK_MILLIS);
  return date.local().format('MMMM D, h:mm A');
});

const currentFrameEndDate = Vue.computed(() => {
  if (!currentFrame.value.lastTick) {
    return '-----';
  }
  const date = dayjs.utc(currentFrame.value.lastTick * TICK_MILLIS);
  return date.local().add(1, 'minute').format('MMMM D, h:mm A');
});

const bitcoinPendingStatus = Vue.ref('');
let checkUnverifiedStatusInterval: ReturnType<typeof setInterval> | null = null;

async function checkUnverifiedBitcoinStatus() {
  if (!personalUtxo.value) return;
  if (personalUtxo.value.status !== 'initialized') {
    if (checkUnverifiedStatusInterval) clearInterval(checkUnverifiedStatusInterval);
    return;
  }
  try {
    const utxo = personalUtxo.value;
    const status = await bitcoinLocks.checkFundingStatus(utxo);
    if (status?.isConfirmed) {
      const pendingBlocks = status.blockHeight - bitcoinLocks.data.bitcoinBlockHeight;
      bitcoinPendingStatus.value =
        pendingBlocks > 0
          ? `Waiting for ${pendingBlocks} more bitcoin block${pendingBlocks > 1 ? 's' : ''}`
          : 'Funding confirmed';
      showCompleteLockOverlay.value = false;
    } else if (status) {
      bitcoinPendingStatus.value = `In bitcoin mempool`;
      showCompleteLockOverlay.value = false;
    } else {
      bitcoinPendingStatus.value = `Waiting for funding...`;
    }
    console.log(bitcoinPendingStatus.value, status);
  } catch (error) {
    console.error('Error checking UTXO status:', error);
    bitcoinPendingStatus.value = `Waiting for funding...`;
  }
}

const treasuryPoolCapitalByFrame = Vue.computed(() => {
  const myVaultId = vault.createdVault?.vaultId;
  if (!myVaultId) return {};

  const byFrame: { [frameId: string]: { me: bigint; total: bigint } } = {};

  for (const [vaultId, vaultStats] of Object.entries(vaults.stats?.vaultsById || {})) {
    for (const change of vaultStats.changesByFrame || []) {
      byFrame[change.frameId - 1] ??= { me: 0n, total: 0n };
      byFrame[change.frameId - 1].total += change.treasuryPool.totalEarnings;
      if (vaultId === myVaultId.toString()) {
        byFrame[change.frameId - 1].me += change.treasuryPool.totalEarnings;
      }
    }
  }
  console.log('BY FRAME', byFrame);
  return byFrame;
});

async function loadChartData() {
  const ticksPerFrame = MiningFrames.ticksPerFrame;
  const currentTick = MiningFrames.calculateCurrentTickFromSystemTime();
  const startingDate = dayjs.utc().startOf('day');
  const startingTickRange = MiningFrames.getTickRangeForFrame(stats.latestFrameId);
  const progress = ((currentTick - startingTickRange[0]) / ticksPerFrame) * 100;

  const records: IFrameRecord[] = [
    {
      id: stats.latestFrameId,
      date: startingDate.format('YYYY-MM-DD'),
      firstTick: startingTickRange[0],
      lastTick: startingTickRange[1],
      totalTreasuryPayout: treasuryPoolCapitalByFrame.value[stats.latestFrameId]?.total || 0n,
      myTreasuryPayout: treasuryPoolCapitalByFrame.value[stats.latestFrameId]?.me || 0n,
      score: 100,
      progress,
    },
  ];

  while (records.length < 365) {
    const earliestRecord = records[0];
    if (!earliestRecord) break;
    const previousDay = dayjs.utc(earliestRecord.date).subtract(1, 'day');
    if (previousDay.isBefore(dayjs.utc('2025-01-01'))) {
      break;
    }

    const blankRecord = {
      id: earliestRecord.id - 1,
      date: previousDay.format('YYYY-MM-DD'),
      firstTick: earliestRecord.firstTick - ticksPerFrame,
      lastTick: earliestRecord.lastTick - ticksPerFrame,
      myTreasuryPayout: 0n,
      totalTreasuryPayout: 0n,
      score: 0,
      progress: 100,
    };
    records.unshift(blankRecord);
  }

  let isFiller = true;
  const items: any[] = [];
  for (const [index, frame] of records.entries()) {
    if (isFiller && frame.score > 0) {
      const previousItem = items[index - 1];
      previousItem && (previousItem.isFiller = false);
      isFiller = false;
    }
    const item = {
      date: frame.date,
      score: frame.score,
      progress: frame.progress,
      frameId: frame.id,
      totalTreasuryPayout: frame.totalTreasuryPayout,
      myTreasuryPayout: frame.myTreasuryPayout,
      isFiller,
      previous: items[index - 1],
      next: undefined,
    };
    items.push(item);
  }

  for (const [index, item] of items.entries()) {
    item.next = items[index + 1];
  }

  chartItems.value = items;
  frameRecords.value = records;
}

Vue.onMounted(async () => {
  await vault.load();
  await vault.subscribe();
  await bitcoinLocks.load();
  await bitcoinLocks.subscribe();

  updateLockExpiration();

  try {
    updateVaultErrorMessage.value = '';
    await vault.saveVaultRules({
      argonKeyring: config.vaultingAccount,
      bitcoinLocksStore: bitcoinLocks,
      bip39Seed: config.bitcoinXprivSeed,
      rules: vaultingRules,
      txProgressCallback(progress: number) {
        if (progress > 0) {
          isUpdatingVault.value = true;
        }
        updateVaultProgressPct.value = progress;
      },
    });
    updateVaultProgressPct.value = 100;
    if (isUpdatingVault.value) {
      setTimeout(() => (isUpdatingVault.value = false), 60000);
    }
  } catch (error) {
    console.error('Error prebonding treasury pool:', error);
    updateVaultErrorMessage.value = error instanceof Error ? error.message : `${error}`;
    updateVaultProgressPct.value = 100;
  }

  if (personalUtxo.value) {
    const utxo = personalUtxo.value;
    btcMarketRate.value = await vaults.getRedemptionRate(utxo).catch(() => 0n);
    if (utxo.status === 'releaseRequested' || utxo.status === 'vaultCosigned') {
      showReleaseOverlay.value = true;
    }
    if (utxo.status === 'initialized') {
      checkUnverifiedStatusInterval = setInterval(checkUnverifiedBitcoinStatus, 1000);
    }
    lockInitializeExpirationTime.value = dayjs(bitcoinLocks.verifyExpirationTime(utxo));
  }

  await loadChartData();
});

function openVaultOverlay() {
  basicEmitter.emit('openVaultOverlay');
}

Vue.onUnmounted(() => {
  vault.unsubscribe();
  bitcoinLocks.unsubscribe();
  if (checkUnverifiedStatusInterval) clearInterval(checkUnverifiedStatusInterval);
});
</script>

<style scoped>
@reference "../../main.css";

[box] {
  @apply rounded border-[1px] border-slate-400/30 bg-white py-2 shadow;
}

[stat-box] {
  @apply flex flex-col items-center justify-center text-[#963EA7];

  span {
    @apply text-4xl font-bold;
  }

  label {
    @apply mt-1 text-sm text-gray-500;
  }
}
</style>
