<template>
  <TransitionRoot :show="isOpen" as="template" enter="duration-300 ease-out" enter-from="opacity-0" enter-to="opacity-100" leave="duration-200 ease-in" leave-from="opacity-100" leave-to="opacity-0">
    <Dialog @close="maybeCloseOverlay" :initialFocus="dialogPanel">

      <DialogPanel class="absolute top-0 left-0 right-0 bottom-0 z-10">
        <BgOverlay @close="maybeCloseOverlay" />
        <div ref="dialogPanel" class="absolute top-[40px] left-3 right-3 bottom-3 flex flex-col overflow-hidden rounded-md border border-black/30 inner-input-shadow bg-argon-menu-bg text-left transition-all" style="box-shadow: 0px -1px 2px 0 rgba(0, 0, 0, 0.1), inset 0 2px 0 rgba(255,255,255,1)">

          <BidBreakdownTooltip v-if="isShowingBreakdownTooltip" :data="scenarioData" />

          <div v-if="isLoaded" class="flex flex-col h-full w-full">
            <h2 class="relative text-3xl font-bold text-center border-b border-slate-300 pt-5 pb-4 pl-3 mx-4 cursor-pointer text-[#672D73]" style="box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1)">
              Configure Bidding Rules
              <div @click="closeOverlay" class="absolute top-[22px] right-[0px] z-10 flex items-center justify-center text-sm/6 font-semibold cursor-pointer border rounded-md w-[30px] h-[30px] focus:outline-none border-slate-400/60 hover:border-slate-500/70 hover:bg-[#D6D9DF]">
                <XMarkIcon class="w-5 h-5 text-[#B74CBA] stroke-4" />
              </div>
            </h2>

            <div class="grow relative w-full">
              <div class="absolute h-[20px] left-0 right-0 bottom-0 z-10 bg-gradient-to-b from-transparent to-argon-menu-bg pointer-events-none"></div>
              <div class="absolute top-0 left-0 right-0 bottom-0 px-[6%] overflow-y-scroll pt-8 pb-[50px]">

                <p class="opacity-80 font-light">Commander has a built-in bidding bot that helps maximize your chance of winning seats. This page allows you to configure the rules for how this bot should make decisions and place bids.</p>

                <div class="flex flex-col border border-yellow-800/20 rounded-md p-4 mt-4 shadow-md">
                  <h3 class="text-xl font-bold border-b border-yellow-800/10 pb-2 text-center">Basic Calculator Settings</h3>
                  <div class="flex flex-col gap-6 pl-2 pt-6 pb-2 font-mono text-md">
                    <div class="flex flex-row items-center gap-2">
                      <header class="whitespace-nowrap pr-1">Num of Seats You Want to Win = </header>
                      <InputNumber v-model="calculatedTotalSeats" :max="100" :min="1" :options="calculatedTotalSeatMenu" class="w-4/12" />
                      <InfoTip>This determines how many argons and argonots your account will need before it can start bidding.</InfoTip>
                    </div>
                    <div class="flex flex-row items-center gap-2">
                      <header class="whitespace-nowrap pr-1">Expected Argon Circulation &nbsp; = </header>
                      <InputMenu :options="{ value: 'Between' }" :disabled="true" />
                      <InputNumber v-model="calculatedArgonCirculationMin" :disabled="true" />
                      <span>and</span>
                      <InputNumber v-model="calculatedArgonCirculation" :max="5_000_000_000" :min="calculatedArgonCirculationMin" :dragBy="1_000_000" :options="calculatedArgonCirculationMenu" />
                      <span class="pl-1">Within the Next Year</span>
                      <InfoTip>These contribute to mining rewards. We use this to help calculate your optimistic scenarios below.</InfoTip>
                    </div>
                    <div class="flex flex-row items-center gap-2">
                      <header class="whitespace-nowrap pr-1">Argonot Ten Day Price Change = </header>
                      <InputMenu v-model="argonotPriceChangeType" :options="[{ value: 'Between' }, { value: 'Exactly' }]" />
                      <InputNumber v-model="argonotPriceChangeMin" :max="100" :min="-100" :prefix="argonotPriceChangeMin > 0 ? '+' : ''" format="percent" />
                      <div v-if="argonotPriceChangeType === 'Between'" class="flex flex-row items-center gap-2">
                        <span>and</span>
                        <InputNumber v-model="argonotPriceChangeMax" :max="100" :min="argonotPriceChangeMin+1" :prefix="argonotPriceChangeMax > 0 ? '+' : ''" format="percent" />
                      </div>
                      <span class="pl-1">Within the Next Ten Days</span>
                      <InfoTip>The price of ARGNOTs naturally fluctuate on the open market. The has an affect on your mining returns.</InfoTip>
                    </div>
                  </div>
                </div>

                <section class="flex flex-row mt-8">
                  <div class="flex flex-col w-8/12">
                    <header>Starting Bid</header>
                    <p class="opacity-80 font-light">This is the minimum amount you want to bid. It should be lower than your maximum bid but not too low. Setting this too low will require lots of incremental bids with each bid requiring a small transaction fee -- this can add up.</p>

                    <label class="font-bold mt-6 mb-1.5">Starting Amount</label>
                    <div class="flex flex-row items-center gap-2">
                      <InputMenu v-model="startingAmountFormulaType" :options="[
                        { name: 'Previous Day\'s Lowest Bid', value: 'PreviousLowestBid' },
                        { name: 'Minimum Breakeven', value: 'MinimumBreakeven' },
                        { name: 'Optimistic Breakeven', value: 'OptimisticBreakeven' },
                        { name: 'Custom Amount', value: 'Custom' }
                      ]" />
                      <template v-if="startingAmountFormulaType !== 'Custom'">
                        =
                        <InputNumber v-model="startingAmountFormulaPrice" :disabled="true" format="argons" />
                        +
                        <InputNumber v-model="startingAmountFormulaIncrease" :min="-100" :dragBy="0.01" format="percent" />
                      </template>
                      =
                      <InputNumber v-model="startingAmount" :min="0" format="argons" :disabled="startingAmountFormulaType !== 'Custom'" :class="[startingAmountFormulaType === 'Custom' ? 'min-w-60' : '']" />
                    </div>
                  </div>
                  <div class="flex flex-col w-4/12">
                    <header>&nbsp;</header>
                    <div class="flex flex-col bg-yellow-50/30 border border-yellow-800/20 rounded-md shadow-md p-4 pt-5 mt-[3px] text-center ml-5">
                      <div class="font-bold text-[22px] py-1">If You Buy @ Starting Bid</div>
                      <div class="font-light text-sm leading-6">This box calculates your APR (Annual Percentage Rate) on a bid of {{currencySymbol}}{{ argonTo(startingAmount) < 10 ? argonTo(startingAmount).toFixed(2) : argonTo(startingAmount).toFixed(0) }}.</div>

                      <div class="h-[1px] bg-yellow-800/20 my-4"></div>
                      <div class="relative flex flex-col pt-6 pb-5 hover:bg-yellow-700/5 cursor-pointer group" @mousemove="showBreakdownTooltip(startingOptimisticCalculator)" @mouseleave="hideBreakdownTooltip()">
                        <BidBreakdownTooltipArrow />
                        <div class="font-bold text-sm uppercase">Optimistic APR</div>
                        <div class="text-5xl font-bold py-1">{{ fmtCommas(Math.min(startingOptimisticAPR, 999_999).toString()) }}{{ startingOptimisticAPR > 999_999 ? '+' : '' }}%</div>
                        <div class="font-light text-md">({{fmtCommas(startingOptimisticTDPR.toString())}}% Every 10 Days)</div>
                      </div>
                      <div class="h-[1px] bg-yellow-800/20 my-4"></div>
                      <div class="relative flex flex-col pt-6 pb-5 hover:bg-yellow-700/5 cursor-pointer group" @mousemove="showBreakdownTooltip(startingMinimumCalculator)" @mouseleave="hideBreakdownTooltip()">
                        <BidBreakdownTooltipArrow />
                        <div class="font-bold text-sm uppercase">Minimum APR</div>
                        <div class="text-5xl font-bold py-1">{{ fmtCommas(Math.min(startingMinimumAPR, 999_999).toString()) }}{{ startingMinimumAPR > 999_999 ? '+' : '' }}%</div>
                        <div class="font-light text-md">({{fmtCommas(startingMinimumTDPR.toString())}}% Every 10 Days)</div>
                      </div>
                    </div>
                  </div>
                </section>

                <section class="flex flex-row mt-8">
                  <div class="flex flex-col w-8/12">
                    <header>Rebidding Strategy</header>
                    <p class="opacity-80 font-light">This is the minimum amount you want to bid. It should be lower than your maximum bid but not too low. Setting this too low will require lots of incremental bids with each bid requiring a small transaction fee -- this can add up.</p>

                    <label class="font-bold mt-6 mb-1.5">Delay Before Submitting Next Bid</label>
                    <!-- <p class="opacity-80 font-light">By default your bot tries to reup your losing bids in the next block (next minute), however, you can increase this delay.</p> -->
                    <InputNumber v-model="rebiddingDelay" :min="1" class="w-8/12" />

                    <label class="font-bold mt-6 mb-1.5">Increment By</label>
                    <!-- <p class="opacity-80 font-light">The amount you want to increment your losing bids in order to get back in the game.</p> -->
                    <InputNumber v-model="incrementAmount" :min="0.01" :dragBy="1" :dragByMin="0.01" format="argons" class="w-8/12" />
                  </div>
                  <div class="flex flex-col w-4/12">
                    <header>&nbsp;</header>
                    <div class="flex flex-col bg-yellow-50/30 border border-yellow-800/20 rounded-md shadow-md px-10 pt-7 pb-8 text-center ml-5 mt-1 h-full">
                      <div class="flex flex-row items-center justify-center">
                        <LightBulbIcon class="w-10 h-10 text-yellow-500" />
                      </div>
                      <div class="font-bold text-2xl pt-3">Recommendation</div>
                      <p class="font-light text-md pt-2 text-justify">
                        We suggest setting your Delay to 10 minutes and your Increment By to a minimum of 5 ARGNs. This ensures that you won't spend too much on transaction fees by
                        submitting bids too quickly.
                      </p>
                      <button @click="applyRecommendedRebiddingSettings" :class="appliedRecommendedRebiddingSettings ? 'pointer-events-none opacity-40' : ''" class="border border-yellow-700 text-yellow-800 hover:bg-yellow-700 hover:text-white py-1 mt-5 rounded-md cursor-pointer">
                        <span v-if="!appliedRecommendedRebiddingSettings">Apply Recommendations</span>
                        <span v-else>Recommendations Applied</span>
                      </button>
                    </div>
                  </div>
                </section>

                <section class="flex flex-row mt-8">
                  <div class="flex flex-col w-8/12">
                    <header>Final Ceiling</header>
                    <p class="opacity-80 font-light">This section sets your bid ceiling. If the auction goes above this price, your bot will stop participating. We recommend setting this to the highest price you're willing to pay.</p>

                    <label class="font-bold mt-6 mb-1.5">Your Final Bid Price</label>
                    <div class="flex flex-row items-center gap-2">
                      <InputMenu v-model="finalAmountFormulaType" :options="[
                        { name: 'Previous Day\'s Winning Bid', value: 'PreviousHighestBid' },
                        { name: 'Minimum Breakeven', value: 'MinimumBreakeven' },
                        { name: 'Optimistic Breakeven', value: 'OptimisticBreakeven' },
                        { name: 'Custom Amount', value: 'Custom' }
                      ]" />
                      <template v-if="finalAmountFormulaType !== 'Custom'">
                        =
                        <InputNumber v-model="finalAmountFormulaPrice" :disabled="true" format="argons" />
                        +
                        <InputNumber v-model="finalAmountFormulaIncrease" :min="-100" :dragBy="0.01" format="percent" />
                      </template>
                      =
                      <InputNumber v-model="finalAmount" :min="0" format="argons" :disabled="finalAmountFormulaType !== 'Custom'" :class="[finalAmountFormulaType === 'Custom' ? 'min-w-60' : '']" />
                    </div>
                  </div>
                  <div class="flex flex-col w-4/12">
                    <header>&nbsp;</header>
                    <div class="flex flex-col bg-yellow-50/30 border border-yellow-800/20 rounded-md shadow-md p-4 pt-5 mt-0.5 text-center ml-5">
                      <div class="font-bold text-[22px] py-1">If You Buy @ Final Ceiling</div>
                      <div class="font-light text-sm leading-6">This box calculates your APR (Annual Percentage Rate) on a bid of {{currencySymbol}}{{ argonTo(finalAmount) < 10 ? argonTo(finalAmount).toFixed(2) : argonTo(finalAmount).toFixed(0) }}.</div>

                      <div class="h-[1px] bg-yellow-800/20 my-4"></div>
                      <div class="relative flex flex-col pt-6 pb-5 hover:bg-yellow-700/5 cursor-pointer group" @mousemove="showBreakdownTooltip(finalOptimisticCalculator)" @mouseleave="hideBreakdownTooltip()">
                        <BidBreakdownTooltipArrow />
                        <div class="font-bold text-sm uppercase">Optimistic APR</div>
                        <div class="text-5xl font-bold py-1">{{ fmtCommas(Math.min(finalOptimisticAPR, 999_999).toString()) }}{{ finalOptimisticAPR > 999_999 ? '+' : '' }}%</div>
                        <div class="font-light text-md">({{fmtCommas(finalOptimisticTDPR.toString())}}% Every 10 Days)</div>
                      </div>
                      <div class="h-[1px] bg-yellow-800/20 my-4"></div>
                      <div class="relative flex flex-col pt-6 pb-5 hover:bg-yellow-700/5 cursor-pointer group" @mousemove="showBreakdownTooltip(finalMinimumCalculator)" @mouseleave="hideBreakdownTooltip()">
                        <BidBreakdownTooltipArrow />
                        <div class="font-bold text-sm uppercase">Minimum APR</div>
                        <div class="text-5xl font-bold py-1">{{ fmtCommas(Math.min(finalMinimumAPR, 999_999).toString()) }}{{ finalMinimumAPR > 999_999 ? '+' : '' }}%</div>
                        <div class="font-light text-md">({{fmtCommas(finalMinimumTDPR.toString())}}% Every 10 Days)</div>
                      </div>
                    </div>
                  </div>
                </section>

                <section class="flex flex-row mt-8">
                  <div class="flex flex-col w-8/12">
                    <header>Throttling Strategies</header>
                    <p class="opacity-80 font-light">
                      By default, your bidding bot will try to win as may seats as it can, and sometimes this means you'll win all your seats on a single day. Unless this is your strategy, you'll probably want to
                      set one or more throttles to ensure you win seats across multiple slots.
                    </p>

                    <ul class="flex flex-col gap-y-2 mt-4">
                      <li class="flex flex-row w-full font-mono text-md items-center h-[32px]">
                        <div class="group grid size-5 grid-cols-1">
                          <input type="checkbox" v-model="throttleSeats" class="col-start-1 row-start-1 appearance-none rounded border border-gray-600 bg-white checked:border-argon-button checked:bg-argon-button indeterminate:border-argon-button indeterminate:bg-argon-button focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-argon-button" />
                          <svg class="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-[:disabled]:stroke-gray-950/25" viewBox="0 0 14 14" fill="none">
                            <path class="opacity-0 group-has-[:checked]:opacity-100" d="M3 8L6 11L11 3.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            <path class="opacity-0 group-has-[:indeterminate]:opacity-100" d="M3 7H11" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                          </svg>
                        </div>
                        <div :class="throttleSeats ? '' : 'opacity-50'" class="flex flex-row items-center cursor-default">
                          <div @click="throttleSeats = !throttleSeats" class="text-white bg-[#96A1AD] px-2 py-0 rounded-md mx-2">CAP SEATS</div>
                          <span @click="throttleSeats = !throttleSeats">Acquire no more than</span>
                          <InputNumber @click="throttleSeats = true" v-model="throttleSeatCount" :min="1" :max="100" :dragBy="1" class="mx-2" />
                          <span @click="throttleSeats = !throttleSeats">seat{{throttleSeatCount === 1 ? '' : 's'}} per slot</span>
                        </div>
                      </li>

                      <li class="flex flex-row w-full font-mono text-md items-center h-[32px]">
                        <div class="group grid size-5 grid-cols-1">
                          <input type="checkbox" v-model="throttleSpending" class="col-start-1 row-start-1 appearance-none rounded border border-gray-600 bg-white checked:border-argon-button checked:bg-argon-button indeterminate:border-argon-button indeterminate:bg-argon-button focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-argon-button" />
                          <svg class="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-[:disabled]:stroke-gray-950/25" viewBox="0 0 14 14" fill="none">
                            <path class="opacity-0 group-has-[:checked]:opacity-100" d="M3 8L6 11L11 3.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            <path class="opacity-0 group-has-[:indeterminate]:opacity-100" d="M3 7H11" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                          </svg>
                        </div>
                        <div :class="throttleSpending ? '' : 'opacity-50'" class="flex flex-row items-center cursor-default">
                          <div @click="throttleSpending = !throttleSpending" class="text-white bg-[#96A1AD] px-2 py-0 rounded-md mx-2">CAP SPENDING</div>
                          <span @click="throttleSpending = !throttleSpending">Spend no more than</span>
                          <InputNumber @click="throttleSpending = true" v-model="throttleSpendingAmount" :min="finalAmount" :dragBy="1" format="argons" class="mx-2" />
                          <span @click="throttleSpending = !throttleSpending">per slot</span>
                        </div>
                      </li>

                      <li class="flex flex-row w-full font-mono text-md items-center h-[32px]">
                        <div class="group grid size-5 grid-cols-1">
                          <input type="checkbox" v-model="throttleDistributeEvenly" class="col-start-1 row-start-1 appearance-none rounded border border-gray-600 bg-white checked:border-argon-button checked:bg-argon-button indeterminate:border-argon-button indeterminate:bg-argon-button focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-argon-button" />
                          <svg class="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-[:disabled]:stroke-gray-950/25" viewBox="0 0 14 14" fill="none">
                            <path class="opacity-0 group-has-[:checked]:opacity-100" d="M3 8L6 11L11 3.5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                            <path class="opacity-0 group-has-[:indeterminate]:opacity-100" d="M3 7H11" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                          </svg>
                        </div>
                        <div :class="throttleDistributeEvenly ? '' : 'opacity-50'" class="flex flex-row items-center cursor-default">
                          <div @click="throttleDistributeEvenly = !throttleDistributeEvenly" class="text-white bg-[#96A1AD] px-2 py-0 rounded-md mx-2">DISTRIBUTE EVENLY</div>
                          <span @click="throttleDistributeEvenly = !throttleDistributeEvenly">Stagger your mining seats as evenly as possible</span>
                        </div>
                      </li>
                    </ul>
                  </div>
                  <div class="flex flex-col w-4/12">
                    <header>&nbsp;</header>
                    <div class="flex flex-col bg-yellow-50/30 border border-yellow-800/20 rounded-md shadow-md px-10 pt-7 pb-8 text-center ml-5 mt-1 h-full">
                      <div class="flex flex-row items-center justify-center">
                        <LightBulbIcon class="w-10 h-10 text-yellow-500" />
                      </div>
                      <div class="font-bold text-2xl pt-3">Recommendation</div>
                      <p class="font-light text-md pt-2 text-justify">
                        We suggest only using a single throttle, and we believe distributing seat bids as evenly as possible across all slots is the most important. By spreading your bids, you'll have a better chance of capturing demand spikes that drive
                        lucerative minting opportunities.
                      </p>
                      <button @click="applyRecommendedThrottles" :class="appliedRecommendedThrottles ? 'pointer-events-none opacity-40' : ''" class="border border-yellow-700 text-yellow-800 hover:bg-yellow-700 hover:text-white py-1 mt-5 rounded-md cursor-pointer">
                        <span v-if="!appliedRecommendedThrottles">Apply Recommendations</span>
                        <span v-else>Recommendations Applied</span>
                      </button>
                    </div>
                  </div>
                </section>

                <section class="flex flex-row mt-4">
                  <div class="flex flex-col w-8/12">
                    <header>Bot Longevity</header>
                    <p class="opacity-80 font-light">You choose how long you want your bidding bot to work. We recommend setting your bot to Continuous. If you select otherwise, the bot will stop bidding and turn off once its time limit has been reached.</p>

                    <ul class="flex flex-col gap-y-2 mt-4">

                      <li class="flex flex-row w-full font-mono text-md items-center h-[32px]">
                        <RadioButton name="disable-bot" :checked="disableBot === 'AfterFirstSeat'" @click="disableBot = 'AfterFirstSeat'" />
                        <div :class="disableBot === 'AfterFirstSeat' ? '' : 'opacity-50'" class="flex flex-row items-center cursor-default">
                          <div @click="disableBot = 'AfterFirstSeat'" class="text-white bg-[#96A1AD] px-2 py-0 rounded-md mx-2">SINGLE SEAT</div>
                          <span @click="disableBot = 'AfterFirstSeat'">Disable bot after winning first seat</span>
                        </div>
                      </li>

                      <li class="flex flex-row w-full font-mono text-md items-center h-[32px]">
                        <RadioButton name="disable-bot" :checked="disableBot === 'AfterFirstSlot'" @click="disableBot = 'AfterFirstSlot'" />
                        <div :class="disableBot === 'AfterFirstSlot' ? '' : 'opacity-50'" class="flex flex-row items-center cursor-default">
                          <div @click="disableBot = 'AfterFirstSlot'" class="text-white bg-[#96A1AD] px-2 py-0 rounded-md mx-2">SINGLE SLOT</div>
                          <span @click="disableBot = 'AfterFirstSlot'">Disable bot after winning seats in first slot</span>
                        </div>
                      </li>

                      <li class="flex flex-row w-full font-mono text-md items-center h-[32px]">
                        <RadioButton name="disable-bot" :checked="disableBot === 'Never'" @click="disableBot = 'Never'" />
                        <div :class="disableBot === 'Never' ? '' : 'opacity-50'" class="flex flex-row items-center cursor-default">
                          <div @click="disableBot = 'Never'" class="text-white bg-[#96A1AD] px-2 py-0 rounded-md mx-2">CONTINUOUS</div>
                          <span @click="disableBot = 'Never'">Empower bot to continue renewing my seats</span>
                        </div>
                      </li>

                      <li class="flex flex-row w-full font-mono text-md items-center h-[32px]">
                        <RadioButton name="disable-bot" :checked="disableBot === 'Now'" @click="disableBot = 'Now'" />
                        <div :class="disableBot === 'Now' ? '' : 'opacity-50'" class="flex flex-row items-center cursor-default">
                          <div @click="disableBot = 'Now'" class="text-white bg-[#96A1AD] px-2 py-0 rounded-md mx-2">DISABLED</div>
                          <span @click="disableBot = 'Now'">Disable bot immediately</span>
                        </div>
                      </li>

                    </ul>
                  </div>
                  <div class="flex flex-col w-4/12">
                    <header>&nbsp;</header>
                    <div class="flex flex-col bg-yellow-50/30 border border-yellow-800/20 rounded-md shadow-md p-4 pt-6 mt-0.5 text-center ml-5">
                      <div class="font-bold text-xl py-1">Compounding Scenario</div>
                      <div v-if="disableBot === 'AfterFirstSeat'" class="font-light text-sm leading-6">This box calculates your expected range<br /> of returns based on shutting down after<br /> winning a single seat.</div>
                      <div v-if="disableBot === 'AfterFirstSlot'" class="font-light text-sm leading-6">This box calculates your expected range<br /> of returns based on shutting down after<br /> winning a single slot.</div>
                      <div v-else-if="disableBot === 'Never'" class="font-light text-sm leading-6">This box calculates your expected range<br /> of returns based on a full year of mining.</div>

                      <div class="h-[1px] bg-yellow-800/20 my-4"></div>
                      <div v-if="disableBot === 'Now'" class="text-sm uppercase px-10 py-10 opacity-50">Use the settings on the left to enable the bot so we can calculate your returns.</div>
                      <div v-else>
                        <div class="relative flex flex-col pt-6 pb-5 hover:bg-yellow-700/5 cursor-pointer group" @mousemove="showBreakdownTooltip(startingOptimisticCalculator)" @mouseleave="hideBreakdownTooltip()">
                          <BidBreakdownTooltipArrow />
                          <div v-if="['AfterFirstSeat','AfterFirstSlot'].includes(disableBot)">
                            <div class="font-bold text-sm uppercase">Optimistic 10-Day Yield</div>
                            <div class="text-5xl font-bold py-1">{{ fmtCommas(Math.min(startingOptimisticTDPR, 999_999).toString()) }}{{ startingOptimisticTDPR > 999_999 ? '+' : '' }}%</div>
                            <div class="font-light text-md">(Ends After Slot Completion)</div>
                          </div>
                          <div v-else-if="disableBot === 'Never'">
                            <div class="font-bold text-sm uppercase">Optimistic APY</div>
                            <div class="text-5xl font-bold py-1">{{ fmtCommas(Math.min(startingOptimisticAPY, 999_999).toString()) }}{{ startingOptimisticAPY > 999_999 ? '+' : '' }}%</div>
                            <div class="font-light text-md">({{fmtCommas(startingOptimisticTDPR.toFixed(0))}}% Compounding Every 10 Days)</div>
                          </div>
                        </div>
                        <div class="h-[1px] bg-yellow-800/20 my-4"></div>
                        <div class="relative flex flex-col pt-6 pb-5 hover:bg-yellow-700/5 cursor-pointer group" @mousemove="showBreakdownTooltip(finalMinimumCalculator)" @mouseleave="hideBreakdownTooltip()">
                          <BidBreakdownTooltipArrow />
                          <div v-if="['AfterFirstSeat','AfterFirstSlot'].includes(disableBot)">
                            <div class="font-bold text-sm uppercase">Minimum 10-Day Yield</div>
                            <div class="text-5xl font-bold py-1">{{ fmtCommas(Math.min(finalMinimumTDPR, 999_999).toString()) }}{{ finalMinimumTDPR > 999_999 ? '+' : '' }}%</div>
                            <div class="font-light text-md">(Ends After Slot Completion)</div>
                          </div>
                          <div v-else-if="disableBot === 'Never'">
                            <div class="font-bold text-sm uppercase">Minimum APY</div>
                            <div class="text-5xl font-bold py-1">{{ fmtCommas(Math.min(finalMinimumAPY, 999_999).toString()) }}{{ finalMinimumAPY > 999_999 ? '+' : '' }}%</div>
                            <div class="font-light text-md">({{fmtCommas(finalMinimumTDPR.toFixed(0))}}% Compounding Every 10 Days)</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section class="flex flex-row mt-4">
                  <div class="flex flex-col">
                    <header>&nbsp;</header>
                    <p class="opacity-80 font-light w-10/12 mt-5">Once you're satisfied with your bidding rules, click the Save button below. We will then help you move in any necessary funds needed to cover your bids.</p>
                  </div>
                </section>

              </div>
            </div>

            <div class="flex flex-row justify-end px-14 border-t border-slate-300 mx-4 py-4 space-x-4 rounded-b-lg">
              <div class="grow font-bold text-lg text-slate-900/70">
                Tokens Needed: 
                <template v-if="requiredArgons !== desiredArgons">{{ fmtCommas(requiredArgons.toString()) }} - </template>{{ fmtCommas(desiredArgons.toString()) }} Argon{{ desiredArgons === 1 ? '' : 's' }} 
                + 
                <template v-if="requiredArgonots !== desiredArgonots">{{ fmtCommas(requiredArgonots.toString()) }} - </template>{{ fmtCommas(desiredArgonots.toString()) }} Argonot{{ desiredArgonots === 1 ? '' : 's' }}
              </div>
              <div class="flex flex-row space-x-4">
                <button @click="closeOverlay" class="border border-argon-button text-xl font-bold text-gray-500 px-7 py-1 rounded-md cursor-pointer">
                  <span>Close</span>
                </button>
                <button @click="saveRules" class="bg-argon-button text-xl font-bold text-white px-7 py-1 rounded-md cursor-pointer">
                  <span v-if="!isSaving">{{ hasExistingRules ? 'Update' : 'Save' }} Rules</span>
                  <span v-else>{{ hasExistingRules ? 'Updating' : 'Saving' }} Rules...</span>
                </button>
              </div>
            </div>
          </div>
          <div v-else>
            Loading...
          </div>
        </div>
      </DialogPanel>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import dayjs from 'dayjs';
import { storeToRefs } from 'pinia';
import { Dialog, DialogPanel, TransitionRoot } from '@headlessui/vue';
import emitter from '../emitters/basic';
import { fmtCommas } from '../lib/Utils';
import { useConfig } from '../stores/config';
import { useCurrencyStore } from '../stores/currency';
import BgOverlay from '../components/BgOverlay.vue';
import { XMarkIcon, LightBulbIcon } from '@heroicons/vue/24/outline';
import RadioButton from '../components/RadioButton.vue';
import InputNumber from '../components/InputNumber.vue';
import InputMenu from '../components/InputMenu.vue';
import BiddingCalculator, { BiddingCalculatorData, type IBiddingRules } from '@argonprotocol/commander-calculator';
import InfoTip from '../components/InfoTip.vue';
import BidBreakdownTooltip from './BidBreakdownTooltip.vue';
import BidBreakdownTooltipArrow from './BidBreakdownTooltipArrow.vue';
import { getMainchain } from '../stores/mainchain.ts';
import { DisableBotType } from '../interfaces/IBiddingRules.ts';

const config = useConfig();
const currencyStore = useCurrencyStore();

const { argonTo } = currencyStore;
const { currencySymbol } = storeToRefs(currencyStore);

const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);
const isSaving = Vue.ref(false);

const hasExistingRules = Vue.ref(false);

const dialogPanel = Vue.ref(null);
const isShowingBreakdownTooltip = Vue.ref(false);

const requiredArgons = Vue.ref(1);
const requiredArgonots = Vue.ref(1);

const desiredArgons = Vue.ref(1);
const desiredArgonots = Vue.ref(1);

const calculatorData = new BiddingCalculatorData(getMainchain());
const startingMinimumCalculator = new BiddingCalculator('Minimum', calculatorData);
const startingOptimisticCalculator = new BiddingCalculator('Optimistic', calculatorData);
const finalMinimumCalculator = new BiddingCalculator('Minimum', calculatorData);
const finalOptimisticCalculator = new BiddingCalculator('Optimistic', calculatorData);

const startingOptimisticAPR = Vue.ref(0);
const startingOptimisticAPY = Vue.ref(0);
const startingOptimisticTDPR = Vue.ref(0);
const startingMinimumAPR = Vue.ref(0);
const startingMinimumTDPR = Vue.ref(0);
const finalOptimisticAPR = Vue.ref(0);
const finalOptimisticTDPR = Vue.ref(0);
const finalMinimumAPR = Vue.ref(0);
const finalMinimumAPY = Vue.ref(0);
const finalMinimumTDPR = Vue.ref(0);

const scenarioData = Vue.ref({} as any);

// Total Seats
const calculatedTotalSeatMenu = Vue.ref([
  { title: 'Curious Beginner', value: 1, description: 'Recommended if you\'re just starting.', current: true },
  { title: 'Committed Supporter', value: 3, description: 'Be a major player with multiple seats.', current: false },
  { title: 'Bold Speculator', value: 10, description: 'You think argon is going to the moon.', current: false },
  { title: 'Degenerate Gambler', value: 20, description: 'We never recommend this to anyone.', current: false },
]);
const calculatedTotalSeats = Vue.ref(calculatedTotalSeatMenu.value[1].value);

// Argon Circulation
const calculatedArgonCirculationMenu = Vue.ref([
  { title: 'Slow Growth', value: 2_000_000, current: true },
  { title: 'Good Growth', value: 10_000_000, current: false },
  { title: 'Great Growth', value: 100_000_000, current: false },
  { title: 'Ethena Growth Rate', value: 5_000_000_000, current: false },
]);
const calculatedArgonCirculation = Vue.ref(calculatedArgonCirculationMenu.value[0].value);
const calculatedArgonCirculationMin = Vue.ref(0);

Vue.watch(calculatedArgonCirculation, () => {
  startingOptimisticCalculator.setArgonCirculation(calculatedArgonCirculation.value);
  finalOptimisticCalculator.setArgonCirculation(calculatedArgonCirculation.value);
  updateStartingAmountFormulaPrice();
  updateFinalAmountFormulaPrice();
});

// Argonot Price Change
const argonotPriceChangeType = Vue.ref('Between' as IBiddingRules['argonotPriceChangeType']);
const argonotPriceChangeMin = Vue.ref(0);
const argonotPriceChangeMax = Vue.ref(0);

Vue.watch(argonotPriceChangeMin, () => {
  startingMinimumCalculator.setArgonotPriceChange(argonotPriceChangeMin.value);
  finalMinimumCalculator.setArgonotPriceChange(argonotPriceChangeMin.value);
  updateStartingAmountFormulaPrice();
  updateFinalAmountFormulaPrice();
});

Vue.watch(argonotPriceChangeMax, () => {
  startingOptimisticCalculator.setArgonotPriceChange(argonotPriceChangeMax.value);
  finalOptimisticCalculator.setArgonotPriceChange(argonotPriceChangeMax.value);
  updateStartingAmountFormulaPrice();
  updateFinalAmountFormulaPrice();
});

// Starting Amount
const startingAmount = Vue.ref(0);
const startingAmountFormulaType = Vue.ref('PreviousLowestBid' as IBiddingRules['startingAmountFormulaType']);
const startingAmountFormulaPrice = Vue.ref(0);
const startingAmountFormulaIncrease = Vue.ref(0);

function updateStartingAmountFormulaPrice() {
  if (startingAmountFormulaType.value === 'PreviousLowestBid') {
    startingAmountFormulaPrice.value = calculatorData.previousLowestBid;
  } else if (startingAmountFormulaType.value === 'MinimumBreakeven') {
    startingAmountFormulaPrice.value = startingMinimumCalculator.breakevenBid;
  } else if (startingAmountFormulaType.value === 'OptimisticBreakeven') {
    startingAmountFormulaPrice.value = startingOptimisticCalculator.breakevenBid;
  }
  updateStartingAmount();
}

function updateStartingAmount() {
  if (startingAmountFormulaType.value !== 'Custom') {
    startingAmount.value = startingAmountFormulaPrice.value * (1 + startingAmountFormulaIncrease.value / 100);
  }

  updateStartingCalculators();
}

function updateStartingCalculators() {
  requiredArgons.value = Math.max(1, Math.ceil(startingAmount.value * calculatedTotalSeats.value * 1.1));
  requiredArgonots.value = Math.max(1, Math.ceil(calculatorData.argonotsRequiredForBid * calculatedTotalSeats.value * 1.1));

  startingMinimumCalculator.setBid(startingAmount.value);
  startingOptimisticCalculator.setBid(startingAmount.value);

  startingOptimisticAPR.value = startingOptimisticCalculator.APR;
  startingOptimisticAPY.value = startingOptimisticCalculator.APY;
  startingOptimisticTDPR.value = startingOptimisticCalculator.TDPR;
  startingMinimumAPR.value = startingMinimumCalculator.APR;
  startingMinimumTDPR.value = startingMinimumCalculator.TDPR;
}

Vue.watch(startingAmountFormulaType, updateStartingAmountFormulaPrice);
Vue.watch(startingAmountFormulaIncrease, updateStartingAmount);
Vue.watch(startingAmount, updateStartingCalculators);
Vue.watch(calculatedTotalSeats, updateStartingCalculators);

// Rebidding
const incrementAmount = Vue.ref(0.01);
const rebiddingDelay = Vue.ref(1);
const appliedRecommendedRebiddingSettings = Vue.ref(false);

function applyRecommendedRebiddingSettings() {
  rebiddingDelay.value = 10;
  incrementAmount.value = 5;
  appliedRecommendedRebiddingSettings.value = true;
}

Vue.watch(rebiddingDelay, () => {
  if (rebiddingDelay.value !== 10) {
    appliedRecommendedRebiddingSettings.value = false;
  }
});

Vue.watch(incrementAmount, () => {
  if (incrementAmount.value !== 5) {
    appliedRecommendedRebiddingSettings.value = false;
  }
});

// Final Amount
const finalAmount = Vue.ref(0);
const finalAmountFormulaType = Vue.ref('PreviousHighestBid' as IBiddingRules['finalAmountFormulaType']);
const finalAmountFormulaPrice = Vue.ref(0);
const finalAmountFormulaIncrease = Vue.ref(0);

function updateFinalAmountFormulaPrice() {
  if (finalAmountFormulaType.value === 'PreviousHighestBid') {
    finalAmountFormulaPrice.value = calculatorData.previousHighestBid;
  } else if (finalAmountFormulaType.value === 'MinimumBreakeven') {
    finalAmountFormulaPrice.value = calculatorData.argonRewardsForThisSeat;
  } else if (finalAmountFormulaType.value === 'OptimisticBreakeven') {
    finalAmountFormulaPrice.value = finalOptimisticCalculator.breakevenBid;
  }
  updateFinalAmount();
}

function updateFinalAmount() {
  if (finalAmountFormulaType.value !== 'Custom') {
    finalAmount.value = finalAmountFormulaPrice.value * (1 + finalAmountFormulaIncrease.value / 100);
  }

  updateFinalCalculators();
}

function updateFinalCalculators() {
  desiredArgons.value = Math.max(1, Math.ceil(finalAmount.value * calculatedTotalSeats.value * 1.1));
  desiredArgonots.value = Math.max(1, Math.ceil(calculatorData.argonotsRequiredForBid * calculatedTotalSeats.value * 1.1));

  finalMinimumCalculator.setBid(finalAmount.value);
  finalOptimisticCalculator.setBid(finalAmount.value);

  finalOptimisticAPR.value = finalOptimisticCalculator.APR;
  finalOptimisticTDPR.value = finalOptimisticCalculator.TDPR;
  finalMinimumAPR.value = finalMinimumCalculator.APR;
  finalMinimumAPY.value = finalMinimumCalculator.APY;
  finalMinimumTDPR.value = finalMinimumCalculator.TDPR;
}

Vue.watch(finalAmountFormulaType, updateFinalAmountFormulaPrice);
Vue.watch(finalAmountFormulaIncrease, updateFinalAmount);
Vue.watch(finalAmount, updateFinalCalculators);
Vue.watch(calculatedTotalSeats, updateFinalCalculators);

// Throttles
const throttleSeats = Vue.ref(false);
const throttleSeatCount = Vue.ref(1);
const throttleSpending = Vue.ref(false);
const throttleSpendingAmount = Vue.ref(0);
const throttleDistributeEvenly = Vue.ref(false);
const appliedRecommendedThrottles = Vue.ref(false);

function applyRecommendedThrottles() {
  throttleSeats.value = false;
  throttleSpending.value = false;
  throttleDistributeEvenly.value = true;
  appliedRecommendedThrottles.value = true;
}

// Disable
const disableBot: Vue.Ref<DisableBotType> = Vue.ref(DisableBotType.Never);

async function saveRules() {
  isSaving.value = true;
  const rules: IBiddingRules = {
    calculatedTotalSeats: calculatedTotalSeats.value,
    calculatedArgonCirculation: calculatedArgonCirculation.value,
    argonotPriceChangeType: argonotPriceChangeType.value,
    argonotPriceChangeMin: argonotPriceChangeMin.value,
    argonotPriceChangeMax: argonotPriceChangeMax.value,

    startingAmountFormulaType: startingAmountFormulaType.value,
    startingAmountFormulaIncrease: startingAmountFormulaIncrease.value,
    startingAmount: startingAmount.value,

    rebiddingDelay: rebiddingDelay.value,
    incrementAmount: incrementAmount.value,

    finalAmountFormulaType: finalAmountFormulaType.value,
    finalAmountFormulaIncrease: finalAmountFormulaIncrease.value,
    finalAmount: finalAmount.value,

    throttleSeats: throttleSeats.value,
    throttleSeatCount: throttleSeatCount.value,

    throttleSpending: throttleSpending.value,
    throttleSpendingAmount: throttleSpendingAmount.value,

    throttleDistributeEvenly: throttleDistributeEvenly.value,

    disableBot: disableBot.value,

    requiredArgons: requiredArgons.value,
    requiredArgonots: requiredArgonots.value,

    desiredArgons: desiredArgons.value,
    desiredArgonots: desiredArgonots.value,
  }
  
  config.biddingRules = rules;
  await config.save();

  isSaving.value = false;
  closeOverlay();
}

function maybeCloseOverlay() {
  const secondsSinceOpened = dayjs().diff(openedAt, 'seconds');
  if (secondsSinceOpened < 2) {
    closeOverlay();
  }
};

function closeOverlay() {
  isOpen.value = false;
  isLoaded.value = false;
};

function showBreakdownTooltip(calculator: BiddingCalculator) {
  isShowingBreakdownTooltip.value = true;
  scenarioData.value = {
    scenarioName: calculator.scenarioName,
    costOfArgonotLoss: calculator.costOfArgonotLoss,
    argonotPriceChange: calculator.argonotPriceChange,
    argonotsRequiredForBid: calculatorData.argonotsRequiredForBid,
    argonBidPremium: calculator.argonBidPremium,
    transactionFee: calculatorData.transactionFee,
    argonRewardsForThisSeat: calculatorData.argonRewardsForThisSeat,
    argonotRewardsForThisSeat: calculatorData.argonotRewardsForThisSeat,
    argonsToMintThisSeat: calculator.argonsToMintThisSeat,
    argonotRewardsAsArgonValue: calculator.argonotRewardsAsArgonValue,
    totalCost: calculator.totalCost,
    totalRewards: calculator.totalRewards,
    TDPR: calculator.TDPR,
    APR: calculator.APR,
    APY: calculator.APY,
  };
}

function hideBreakdownTooltip() {
  isShowingBreakdownTooltip.value = false;
}

let openedAt = dayjs();

emitter.on('openBiddingRulesOverlay', async () => {
  if (isOpen.value) return;
  openedAt = dayjs();
  isOpen.value = true;
  calculatorData.isInitialized.then(() => {
    const biddingRules = config.biddingRules || {} as IBiddingRules;
    hasExistingRules.value = !!biddingRules;
    calculatedTotalSeats.value = biddingRules.calculatedTotalSeats || calculatedTotalSeats.value;
    calculatedArgonCirculation.value = biddingRules.calculatedArgonCirculation || calculatedArgonCirculation.value
    argonotPriceChangeType.value = biddingRules.argonotPriceChangeType || argonotPriceChangeType.value
    argonotPriceChangeMin.value = biddingRules.argonotPriceChangeMin || argonotPriceChangeMin.value;
    argonotPriceChangeMax.value = biddingRules.argonotPriceChangeMax || argonotPriceChangeMax.value;
    startingAmount.value = biddingRules.startingAmount || startingAmount.value;
    startingAmountFormulaType.value = biddingRules.startingAmountFormulaType || startingAmountFormulaType.value;
    startingAmountFormulaIncrease.value = biddingRules.startingAmountFormulaIncrease || startingAmountFormulaIncrease.value;
    incrementAmount.value = biddingRules.incrementAmount || incrementAmount.value;
    rebiddingDelay.value = biddingRules.rebiddingDelay || rebiddingDelay.value;
    finalAmount.value = biddingRules.finalAmount || finalAmount.value;
    finalAmountFormulaType.value = biddingRules.finalAmountFormulaType || finalAmountFormulaType.value;
    finalAmountFormulaIncrease.value = biddingRules.finalAmountFormulaIncrease || finalAmountFormulaIncrease.value;
    throttleSeats.value = biddingRules.throttleSeats || throttleSeats.value;
    throttleSeatCount.value = biddingRules.throttleSeatCount || throttleSeatCount.value;
    throttleSpending.value = biddingRules.throttleSpending || throttleSpending.value;
    throttleSpendingAmount.value = biddingRules.throttleSpendingAmount || throttleSpendingAmount.value;
    throttleDistributeEvenly.value = biddingRules.throttleDistributeEvenly || throttleDistributeEvenly.value;
    disableBot.value = biddingRules.disableBot || disableBot.value;

    isLoaded.value = true;
    calculatedArgonCirculationMin.value = Math.ceil(calculatorData.argonRewardsForFullYear);

    updateStartingAmountFormulaPrice();
    updateFinalAmountFormulaPrice();
  });
});
</script>

<style scoped>
@reference "../main.css";

section header {
  @apply text-2xl font-bold pb-3 mb-5 pt-6 border-b border-slate-300;
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
