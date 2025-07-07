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
          <BidBreakdownTooltip v-if="isShowingBreakdownTooltip" :data="scenarioData" />

          <div v-if="isLoaded" class="flex flex-col h-full w-full">
            <h2
              class="relative text-3xl font-bold text-center border-b border-slate-300 pt-5 pb-4 pl-3 mx-4 cursor-pointer text-[#672D73]"
              style="box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1)"
            >
              Configure Bidding Rules
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
                <p class="opacity-80 font-light">
                  Commander has a built-in bidding bot that helps maximize your chance of winning seats. This page
                  allows you to configure the rules for how this bot should make decisions and place bids.
                </p>

                <div class="flex flex-col border border-yellow-800/20 rounded-md p-4 mt-4 shadow-md">
                  <h3 class="text-xl font-bold border-b border-yellow-800/10 pb-2 text-center">
                    Basic Calculator Settings
                  </h3>
                  <div class="flex flex-col gap-6 pl-2 pt-6 pb-2 font-mono text-md">
                    <div class="flex flex-row items-center gap-2">
                      <header class="whitespace-nowrap pr-1">Num of Seats You Want to Win =</header>
                      <InputNumber
                        v-model="calculatedTotalSeats"
                        :max="100"
                        :min="1"
                        :options="calculatedTotalSeatMenu"
                        class="w-4/12"
                      />
                      <InfoTip>
                        This determines how many argons and argonots your account will need before it can start bidding.
                      </InfoTip>
                    </div>
                    <div class="flex flex-row items-center gap-2">
                      <header class="whitespace-nowrap pr-1">Expected Argon Circulation &nbsp; =</header>
                      <InputMenu :options="{ value: 'Between' }" :disabled="true" />
                      <InputNumber v-model="calculatedArgonCirculationMin" :disabled="true" />
                      <span>and</span>
                      <InputNumber
                        v-model="calculatedArgonCirculation"
                        :max="5_000_000_000"
                        :min="calculatedArgonCirculationMin"
                        :dragBy="1_000_000"
                        :options="calculatedArgonCirculationMenu"
                      />
                      <span class="pl-1">Within the Next Year</span>
                      <InfoTip>
                        These contribute to mining rewards. We use this to help calculate your optimistic scenarios
                        below.
                      </InfoTip>
                    </div>
                    <div class="flex flex-row items-center gap-2">
                      <header class="whitespace-nowrap pr-1">Argonot Ten Day Price Change =</header>
                      <InputMenu
                        v-model="micronotPriceChangeType"
                        :options="[{ value: 'Between' }, { value: 'Exactly' }]"
                      />
                      <InputNumber
                        v-model="micronotPriceChangeMin"
                        :max="100"
                        :min="-100"
                        :prefix="micronotPriceChangeMin > 0 ? '+' : ''"
                        format="percent"
                      />
                      <div v-if="micronotPriceChangeType === 'Between'" class="flex flex-row items-center gap-2">
                        <span>and</span>
                        <InputNumber
                          v-model="micronotPriceChangeMax"
                          :max="100"
                          :min="micronotPriceChangeMin + 1n"
                          :prefix="micronotPriceChangeMax > 0 ? '+' : ''"
                          format="percent"
                        />
                      </div>
                      <span class="pl-1">Within the Next Ten Days</span>
                      <InfoTip>
                        The price of ARGNOTs naturally fluctuate on the open market. The has an affect on your mining
                        returns.
                      </InfoTip>
                    </div>
                  </div>
                </div>

                <section class="flex flex-row mt-8">
                  <div class="flex flex-col w-8/12">
                    <header>Starting Bid</header>
                    <p class="opacity-80 font-light">
                      This is the minimum amount you want to bid. It should be lower than your maximum bid but not too
                      low. Setting this too low will require lots of incremental bids with each bid requiring a small
                      transaction fee -- this can add up.
                    </p>

                    <label class="font-bold mt-6 mb-1.5">Starting Amount</label>
                    <div class="flex flex-row items-center gap-2">
                      <InputMenu
                        v-model="startingBidAmountFormulaType"
                        :options="[
                          { name: 'Previous Day\'s Lowest Bid', value: 'PrevDayLow' },
                          { name: 'Minimum Breakeven', value: 'MinBreakeven' },
                          { name: 'Optimistic Breakeven', value: 'OptBreakeven' },
                          { name: 'Custom Amount', value: 'Custom' },
                        ]"
                      />
                      <template v-if="startingBidAmountFormulaType !== 'Custom'">
                        =
                        <InputNumber v-model="startingAmountFormulaPrice" :disabled="true" format="argons" />
                        +
                        <InputNumber v-model="startingBidAmountAbsolute" :min="-100" :dragBy="0.01" format="percent" />
                      </template>
                      =
                      <InputNumber
                        v-model="startingBidAmountAbsolute"
                        :min="0"
                        format="argons"
                        :disabled="startingBidAmountFormulaType !== 'Custom'"
                        :class="[startingBidAmountFormulaType === 'Custom' ? 'min-w-60' : '']"
                      />
                    </div>
                  </div>
                  <div class="flex flex-col w-4/12">
                    <header>&nbsp;</header>
                    <div
                      class="flex flex-col bg-yellow-50/30 border border-yellow-800/20 rounded-md shadow-md p-4 pt-5 mt-[3px] text-center ml-5"
                    >
                      <div class="font-bold text-[22px] py-1">If You Buy @ Starting Bid</div>
                      <div class="font-light text-sm leading-6">
                        This box calculates your APR (Annual Percentage Rate) on a bid of
                        {{ currency.symbol
                        }}{{ microgonToMoneyNm(startingBidAmountAbsolute).formatIfElse('< 10', '0,0.00', '0,0') }}.
                      </div>

                      <div class="h-[1px] bg-yellow-800/20 my-4"></div>
                      <div
                        class="relative flex flex-col pt-6 pb-5 hover:bg-yellow-700/5 cursor-pointer group"
                        @mousemove="showBreakdownTooltip(startingOptimisticCalculator)"
                        @mouseleave="hideBreakdownTooltip()"
                      >
                        <BidBreakdownTooltipArrow />
                        <div class="font-bold text-sm uppercase">Optimistic APR</div>
                        <div class="text-5xl font-bold py-1">
                          {{ numeral(startingOptimisticAPR).formatCapped('0,0', 999_999) }}%
                        </div>
                        <div class="font-light text-md">
                          ({{ numeral(startingOptimisticTDPR).formatIfElse('< 10', '0,0.00', '0,0') }} Every 10 Days)
                        </div>
                      </div>
                      <div class="h-[1px] bg-yellow-800/20 my-4"></div>
                      <div
                        class="relative flex flex-col pt-6 pb-5 hover:bg-yellow-700/5 cursor-pointer group"
                        @mousemove="showBreakdownTooltip(startingMinimumCalculator)"
                        @mouseleave="hideBreakdownTooltip()"
                      >
                        <BidBreakdownTooltipArrow />
                        <div class="font-bold text-sm uppercase">Minimum APR</div>
                        <div class="text-5xl font-bold py-1">
                          {{ numeral(startingMinimumAPR).formatCapped('0,0', 999_999) }}%
                        </div>
                        <div class="font-light text-md">
                          ({{ numeral(startingMinimumTDPR).formatIfElse('< 10', '0,0.00', '0,0') }} Every 10 Days)
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section class="flex flex-row mt-8">
                  <div class="flex flex-col w-8/12">
                    <header>Rebidding Strategy</header>
                    <p class="opacity-80 font-light">
                      This is the minimum amount you want to bid. It should be lower than your maximum bid but not too
                      low. Setting this too low will require lots of incremental bids with each bid requiring a small
                      transaction fee -- this can add up.
                    </p>

                    <label class="font-bold mt-6 mb-1.5">Delay Before Submitting Next Bid</label>
                    <InputNumber v-model="rebiddingDelay" :min="1" class="w-8/12" />

                    <label class="font-bold mt-6 mb-1.5">Increment By</label>
                    <InputNumber
                      v-model="incrementAmount"
                      :min="0.01"
                      :dragBy="1"
                      :dragByMin="0.01"
                      format="argons"
                      class="w-8/12"
                    />
                  </div>
                  <div class="flex flex-col w-4/12">
                    <header>&nbsp;</header>
                    <div
                      class="flex flex-col bg-yellow-50/30 border border-yellow-800/20 rounded-md shadow-md px-10 pt-7 pb-8 text-center ml-5 mt-1 h-full"
                    >
                      <div class="flex flex-row items-center justify-center">
                        <LightBulbIcon class="w-10 h-10 text-yellow-500" />
                      </div>
                      <div class="font-bold text-2xl pt-3">Recommendation</div>
                      <p class="font-light text-md pt-2 text-justify">
                        We suggest setting your Delay to 10 minutes and your Increment By to a minimum of 5 ARGNs. This
                        ensures that you won't spend too much on transaction fees by submitting bids too quickly.
                      </p>
                      <button
                        @click="applyRecommendedRebiddingSettings"
                        :class="appliedRecommendedRebiddingSettings ? 'pointer-events-none opacity-40' : ''"
                        class="border border-yellow-700 text-yellow-800 hover:bg-yellow-700 hover:text-white py-1 mt-5 rounded-md cursor-pointer"
                      >
                        <span v-if="!appliedRecommendedRebiddingSettings">Apply Recommendations</span>
                        <span v-else>Recommendations Applied</span>
                      </button>
                    </div>
                  </div>
                </section>

                <section class="flex flex-row mt-8">
                  <div class="flex flex-col w-8/12">
                    <header>Final Ceiling</header>
                    <p class="opacity-80 font-light">
                      This section sets your bid ceiling. If the auction goes above this price, your bot will stop
                      participating. We recommend setting this to the highest price you're willing to pay.
                    </p>

                    <label class="font-bold mt-6 mb-1.5">Your Final Bid Price</label>
                    <div class="flex flex-row items-center gap-2">
                      <InputMenu
                        v-model="finalBidAmountFormulaType"
                        :options="[
                          { name: 'Previous Day\'s Winning Bid', value: 'PrevDayHigh' },
                          { name: 'Minimum Breakeven', value: 'MinBreakeven' },
                          { name: 'Optimistic Breakeven', value: 'OptBreakeven' },
                          { name: 'Custom Amount', value: 'Custom' },
                        ]"
                      />
                      <template v-if="finalBidAmountFormulaType !== 'Custom'">
                        =
                        <InputNumber v-model="finalAmountFormulaPrice" :disabled="true" format="argons" />
                        +
                        <InputNumber v-model="finalBidAmountAbsolute" :min="-100" :dragBy="0.01" format="percent" />
                      </template>
                      =
                      <InputNumber
                        v-model="finalBidAmountAbsolute"
                        :min="0"
                        format="argons"
                        :disabled="finalBidAmountFormulaType !== 'Custom'"
                        :class="[finalBidAmountFormulaType === 'Custom' ? 'min-w-60' : '']"
                      />
                    </div>
                  </div>
                  <div class="flex flex-col w-4/12">
                    <header>&nbsp;</header>
                    <div
                      class="flex flex-col bg-yellow-50/30 border border-yellow-800/20 rounded-md shadow-md p-4 pt-5 mt-0.5 text-center ml-5"
                    >
                      <div class="font-bold text-[22px] py-1">If You Buy @ Final Ceiling</div>
                      <div class="font-light text-sm leading-6">
                        This box calculates your APR (Annual Percentage Rate) on a bid of
                        {{ currency.symbol
                        }}{{ microgonToMoneyNm(finalBidAmountAbsolute).formatIfElse('< 10', '0,0.00', '0,0') }}.
                      </div>

                      <div class="h-[1px] bg-yellow-800/20 my-4"></div>
                      <div
                        class="relative flex flex-col pt-6 pb-5 hover:bg-yellow-700/5 cursor-pointer group"
                        @mousemove="showBreakdownTooltip(finalOptimisticCalculator)"
                        @mouseleave="hideBreakdownTooltip()"
                      >
                        <BidBreakdownTooltipArrow />
                        <div class="font-bold text-sm uppercase">Optimistic APR</div>
                        <div class="text-5xl font-bold py-1">
                          {{ numeral(finalOptimisticAPR).formatCapped('0,0', 999_999) }}%
                        </div>
                        <div class="font-light text-md">
                          ({{ numeral(finalOptimisticTDPR).formatIfElse('< 10', '0,0.00', '0,0') }} Every 10 Days)
                        </div>
                      </div>
                      <div class="h-[1px] bg-yellow-800/20 my-4"></div>
                      <div
                        class="relative flex flex-col pt-6 pb-5 hover:bg-yellow-700/5 cursor-pointer group"
                        @mousemove="showBreakdownTooltip(finalMinimumCalculator)"
                        @mouseleave="hideBreakdownTooltip()"
                      >
                        <BidBreakdownTooltipArrow />
                        <div class="font-bold text-sm uppercase">Minimum APR</div>
                        <div class="text-5xl font-bold py-1">
                          {{ numeral(finalMinimumAPR).formatCapped('0,0', 999_999) }}%
                        </div>
                        <div class="font-light text-md">
                          ({{ numeral(finalMinimumTDPR).formatIfElse('< 10', '0,0.00', '0,0') }} Every 10 Days)
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section class="flex flex-row mt-8">
                  <div class="flex flex-col w-8/12">
                    <header>Throttling Strategies</header>
                    <p class="opacity-80 font-light">
                      By default, your bidding bot will try to win as may seats as it can, and sometimes this means
                      you'll win all your seats on a single day. Unless this is your strategy, you'll probably want to
                      set one or more throttles to ensure you win seats across multiple slots.
                    </p>

                    <ul class="flex flex-col gap-y-2 mt-4">
                      <li class="flex flex-row w-full font-mono text-md items-center h-[32px]">
                        <div class="group grid size-5 grid-cols-1">
                          <input
                            type="checkbox"
                            v-model="throttleSeats"
                            class="col-start-1 row-start-1 appearance-none rounded border border-gray-600 bg-white checked:border-argon-button checked:bg-argon-button indeterminate:border-argon-button indeterminate:bg-argon-button focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-argon-button"
                          />
                          <svg
                            class="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-[:disabled]:stroke-gray-950/25"
                            viewBox="0 0 14 14"
                            fill="none"
                          >
                            <path
                              class="opacity-0 group-has-[:checked]:opacity-100"
                              d="M3 8L6 11L11 3.5"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                            <path
                              class="opacity-0 group-has-[:indeterminate]:opacity-100"
                              d="M3 7H11"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                          </svg>
                        </div>
                        <div
                          :class="throttleSeats ? '' : 'opacity-50'"
                          class="flex flex-row items-center cursor-default"
                        >
                          <div
                            @click="throttleSeats = !throttleSeats"
                            class="text-white bg-[#96A1AD] px-2 py-0 rounded-md mx-2"
                          >
                            CAP SEATS
                          </div>
                          <span @click="throttleSeats = !throttleSeats">Acquire no more than</span>
                          <InputNumber
                            @click="throttleSeats = true"
                            v-model="throttleSeatCount"
                            :min="1"
                            :max="100"
                            :dragBy="1"
                            class="mx-2"
                          />
                          <span @click="throttleSeats = !throttleSeats">
                            seat{{ throttleSeatCount === 1 ? '' : 's' }} per slot
                          </span>
                        </div>
                      </li>

                      <li class="flex flex-row w-full font-mono text-md items-center h-[32px]">
                        <div class="group grid size-5 grid-cols-1">
                          <input
                            type="checkbox"
                            v-model="throttleSpending"
                            class="col-start-1 row-start-1 appearance-none rounded border border-gray-600 bg-white checked:border-argon-button checked:bg-argon-button indeterminate:border-argon-button indeterminate:bg-argon-button focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-argon-button"
                          />
                          <svg
                            class="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-[:disabled]:stroke-gray-950/25"
                            viewBox="0 0 14 14"
                            fill="none"
                          >
                            <path
                              class="opacity-0 group-has-[:checked]:opacity-100"
                              d="M3 8L6 11L11 3.5"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                            <path
                              class="opacity-0 group-has-[:indeterminate]:opacity-100"
                              d="M3 7H11"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                          </svg>
                        </div>
                        <div
                          :class="throttleSpending ? '' : 'opacity-50'"
                          class="flex flex-row items-center cursor-default"
                        >
                          <div
                            @click="throttleSpending = !throttleSpending"
                            class="text-white bg-[#96A1AD] px-2 py-0 rounded-md mx-2"
                          >
                            CAP SPENDING
                          </div>
                          <span @click="throttleSpending = !throttleSpending">Spend no more than</span>
                          <!-- <InputNumber
                            v-model="throttleSpendingAmount"
                            :min="finalBidAmountAbsolute"
                            format="argons"
                            class="mx-2"
                          /> -->
                          <!-- <InputNumber
                            @click="throttleSpending = true"
                            v-model="throttleSpendingAmount"
                            :min="finalBidAmountAbsolute"
                            :dragBy="1"
                            format="argons"
                            class="mx-2"
                          /> -->
                          <span @click="throttleSpending = !throttleSpending">per slot</span>
                        </div>
                      </li>

                      <li class="flex flex-row w-full font-mono text-md items-center h-[32px]">
                        <div class="group grid size-5 grid-cols-1">
                          <input
                            type="checkbox"
                            v-model="throttleDistributeEvenly"
                            class="col-start-1 row-start-1 appearance-none rounded border border-gray-600 bg-white checked:border-argon-button checked:bg-argon-button indeterminate:border-argon-button indeterminate:bg-argon-button focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-argon-button"
                          />
                          <svg
                            class="pointer-events-none col-start-1 row-start-1 size-3.5 self-center justify-self-center stroke-white group-has-[:disabled]:stroke-gray-950/25"
                            viewBox="0 0 14 14"
                            fill="none"
                          >
                            <path
                              class="opacity-0 group-has-[:checked]:opacity-100"
                              d="M3 8L6 11L11 3.5"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                            <path
                              class="opacity-0 group-has-[:indeterminate]:opacity-100"
                              d="M3 7H11"
                              stroke-width="2"
                              stroke-linecap="round"
                              stroke-linejoin="round"
                            />
                          </svg>
                        </div>
                        <div
                          :class="throttleDistributeEvenly ? '' : 'opacity-50'"
                          class="flex flex-row items-center cursor-default"
                        >
                          <div
                            @click="throttleDistributeEvenly = !throttleDistributeEvenly"
                            class="text-white bg-[#96A1AD] px-2 py-0 rounded-md mx-2"
                          >
                            DISTRIBUTE EVENLY
                          </div>
                          <span @click="throttleDistributeEvenly = !throttleDistributeEvenly">
                            Stagger your mining seats as evenly as possible
                          </span>
                        </div>
                      </li>
                    </ul>
                  </div>
                  <!-- <div class="flex flex-col w-4/12">
                    <header>&nbsp;</header>
                    <div
                      class="flex flex-col bg-yellow-50/30 border border-yellow-800/20 rounded-md shadow-md px-10 pt-7 pb-8 text-center ml-5 mt-1 h-full"
                    >
                      <div class="flex flex-row items-center justify-center">
                        <LightBulbIcon class="w-10 h-10 text-yellow-500" />
                      </div>
                      <div class="font-bold text-2xl pt-3">Recommendation</div>
                      <p class="font-light text-md pt-2 text-justify">
                        We suggest only using a single throttle, and we believe distributing seat bids as evenly as
                        possible across all slots is the most important. By spreading your bids, you'll have a better
                        chance of capturing demand spikes that drive lucerative minting opportunities.
                      </p>
                      <button
                        @click="applyRecommendedThrottles"
                        :class="appliedRecommendedThrottles ? 'pointer-events-none opacity-40' : ''"
                        class="border border-yellow-700 text-yellow-800 hover:bg-yellow-700 hover:text-white py-1 mt-5 rounded-md cursor-pointer"
                      >
                        <span v-if="!appliedRecommendedThrottles">Apply Recommendations</span>
                        <span v-else>Recommendations Applied</span>
                      </button>
                    </div>
                  </div> -->
                </section>

                <!-- <section class="flex flex-row mt-4">
                  <div class="flex flex-col w-8/12">
                    <header>Bot Longevity</header>
                    <p class="opacity-80 font-light">
                      You choose how long you want your bidding bot to work. We recommend setting your bot to
                      Continuous. If you select otherwise, the bot will stop bidding and turn off once its time limit
                      has been reached.
                    </p>

                    <ul class="flex flex-col gap-y-2 mt-4">
                      <li class="flex flex-row w-full font-mono text-md items-center h-[32px]">
                        <RadioButton
                          name="disable-bot"
                          :checked="disableBotType === 'AfterFirstSeat'"
                          @click="disableBotType = 'AfterFirstSeat'"
                        />
                        <div
                          :class="disableBotType === 'AfterFirstSeat' ? '' : 'opacity-50'"
                          class="flex flex-row items-center cursor-default"
                        >
                          <div
                            @click="disableBotType = 'AfterFirstSeat'"
                            class="text-white bg-[#96A1AD] px-2 py-0 rounded-md mx-2"
                          >
                            SINGLE SEAT
                          </div>
                          <span @click="disableBotType = 'AfterFirstSeat'">Disable bot after winning first seat</span>
                        </div>
                      </li>

                      <li class="flex flex-row w-full font-mono text-md items-center h-[32px]">
                        <RadioButton
                          name="disable-bot"
                          :checked="disableBotType === 'AfterFirstSlot'"
                          @click="disableBotType = 'AfterFirstSlot'"
                        />
                        <div
                          :class="disableBotType === 'AfterFirstSlot' ? '' : 'opacity-50'"
                          class="flex flex-row items-center cursor-default"
                        >
                          <div
                            @click="disableBotType = 'AfterFirstSlot'"
                            class="text-white bg-[#96A1AD] px-2 py-0 rounded-md mx-2"
                          >
                            SINGLE SLOT
                          </div>
                          <span @click="disableBotType = 'AfterFirstSlot'">
                            Disable bot after winning seats in first slot
                          </span>
                        </div>
                      </li>

                      <li class="flex flex-row w-full font-mono text-md items-center h-[32px]">
                        <RadioButton
                          name="disable-bot"
                          :checked="disableBotType === 'Never'"
                          @click="disableBotType = 'Never'"
                        />
                        <div
                          :class="disableBotType === 'Never' ? '' : 'opacity-50'"
                          class="flex flex-row items-center cursor-default"
                        >
                          <div @click="disableBotType = 'Never'" class="text-white bg-[#96A1AD] px-2 py-0 rounded-md mx-2">
                            CONTINUOUS
                          </div>
                          <span @click="disableBotType = 'Never'">Empower bot to continue renewing my seats</span>
                        </div>
                      </li>

                      <li class="flex flex-row w-full font-mono text-md items-center h-[32px]">
                        <RadioButton name="disable-bot" :checked="disableBotType === 'Now'" @click="disableBotType = 'Now'" />
                        <div
                          :class="disableBotType === 'Now' ? '' : 'opacity-50'"
                          class="flex flex-row items-center cursor-default"
                        >
                          <div @click="disableBotType = 'Now'" class="text-white bg-[#96A1AD] px-2 py-0 rounded-md mx-2">
                            DISABLED
                          </div>
                          <span @click="disableBotType = 'Now'">Disable bot immediately</span>
                        </div>
                      </li>
                    </ul>
                  </div>
                  <div class="flex flex-col w-4/12">
                    <header>&nbsp;</header>
                    <div
                      class="flex flex-col bg-yellow-50/30 border border-yellow-800/20 rounded-md shadow-md p-4 pt-6 mt-0.5 text-center ml-5"
                    >
                      <div class="font-bold text-xl py-1">Compounding Scenario</div>
                      <div v-if="disableBotType === 'AfterFirstSeat'" class="font-light text-sm leading-6">
                        This box calculates your expected range
                        <br />
                        of returns based on shutting down after
                        <br />
                        winning a single seat.
                      </div>
                      <div v-if="disableBotType === 'AfterFirstSlot'" class="font-light text-sm leading-6">
                        This box calculates your expected range
                        <br />
                        of returns based on shutting down after
                        <br />
                        winning a single slot.
                      </div>
                      <div v-else-if="disableBotType === 'Never'" class="font-light text-sm leading-6">
                        This box calculates your expected range
                        <br />
                        of returns based on a full year of mining.
                      </div>

                      <div class="h-[1px] bg-yellow-800/20 my-4"></div>
                      <div v-if="disableBotType === 'Now'" class="text-sm uppercase px-10 py-10 opacity-50">
                        Use the settings on the left to enable the bot so we can calculate your returns.
                      </div>
                      <div v-else>
                        <div
                          class="relative flex flex-col pt-6 pb-5 hover:bg-yellow-700/5 cursor-pointer group"
                          @mousemove="showBreakdownTooltip(startingOptimisticCalculator)"
                          @mouseleave="hideBreakdownTooltip()"
                        >
                          <BidBreakdownTooltipArrow />
                          <div v-if="['AfterFirstSeat', 'AfterFirstSlot'].includes(disableBotType)">
                            <div class="font-bold text-sm uppercase">Optimistic 10-Day Yield</div>
                            <div class="text-5xl font-bold py-1">
                              {{ numeral(startingOptimisticTDPR).formatCapped('0,0', 999_999) }}%
                            </div>
                            <div class="font-light text-md">(Ends After Slot Completion)</div>
                          </div>
                          <div v-else-if="disableBotType === 'Never'">
                            <div class="font-bold text-sm uppercase">Optimistic APY</div>
                            <div class="text-5xl font-bold py-1">
                              {{ numeral(startingOptimisticAPY).formatCapped('0,0', 999_999) }}%
                            </div>
                            <div class="font-light text-md">
                              ({{ numeral(startingOptimisticTDPR).formatIfElse('< 10', '0,0.00', '0,0') }} Compounding Every 10 Days)
                            </div>
                          </div>
                        </div>
                        <div class="h-[1px] bg-yellow-800/20 my-4"></div>
                        <div
                          class="relative flex flex-col pt-6 pb-5 hover:bg-yellow-700/5 cursor-pointer group"
                          @mousemove="showBreakdownTooltip(finalMinimumCalculator)"
                          @mouseleave="hideBreakdownTooltip()"
                        >
                          <BidBreakdownTooltipArrow />
                          <div v-if="['AfterFirstSeat', 'AfterFirstSlot'].includes(disableBotType)">
                            <div class="font-bold text-sm uppercase">Minimum 10-Day Yield</div>
                            <div class="text-5xl font-bold py-1">
                              {{ numeral(finalMinimumTDPR).formatCapped('0,0', 999_999) }}%
                            </div>
                            <div class="font-light text-md">(Ends After Slot Completion)</div>
                          </div>
                          <div v-else-if="disableBotType === 'Never'">
                            <div class="font-bold text-sm uppercase">Minimum APY</div>
                            <div class="text-5xl font-bold py-1">
                              {{ numeral(finalMinimumAPY).formatCapped('0,0', 999_999) }}%
                            </div>
                            <div class="font-light text-md">
                              ({{ numeral(finalMinimumTDPR).formatIfElse('< 10', '0,0.00', '0,0') }} Compounding Every 10 Days)
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section> -->

                <!-- <section class="flex flex-row mt-4">
                  <div class="flex flex-col">
                    <header>&nbsp;</header>
                    <p class="opacity-80 font-light w-10/12 mt-5">
                      Once you're satisfied with your bidding rules, click the Save button below. We will then help you
                      move in any necessary funds needed to cover your bids.
                    </p>
                  </div>
                </section> -->
              </div>
            </div>

            <div class="flex flex-row justify-end px-14 border-t border-slate-300 mx-4 py-4 space-x-4 rounded-b-lg">
              <div class="grow font-bold text-lg text-slate-900/70">
                Tokens Needed:
                <template v-if="requiredMicrogons !== desiredMicrogons">
                  Between {{ microgonToArgonNm(requiredMicrogons).format('0,0') }} &
                </template>
                {{ microgonToArgonNm(desiredMicrogons).format('0,0') }} Argon{{
                  microgonToArgonNm(desiredMicrogons).format('0') === '1' ? '' : 's'
                }}
                +
                <template v-if="requiredMicronots !== desiredMicronots">
                  {{ microgonToArgonNm(requiredMicronots).format('0,0') }} -
                </template>
                {{ microgonToArgonNm(desiredMicronots).format('0,0') }} Argonot{{
                  microgonToArgonNm(desiredMicronots).format('0') === '1' ? '' : 's'
                }}
              </div>
              <div class="flex flex-row space-x-4">
                <button
                  @click="closeOverlay"
                  class="border border-argon-button text-xl font-bold text-gray-500 px-7 py-1 rounded-md cursor-pointer"
                >
                  <span>Close</span>
                </button>
                <button
                  @click="saveRules"
                  class="bg-argon-button text-xl font-bold text-white px-7 py-1 rounded-md cursor-pointer"
                >
                  <span v-if="!isSaving">{{ hasExistingRules ? 'Update' : 'Save' }} Rules</span>
                  <span v-else>{{ hasExistingRules ? 'Updating' : 'Saving' }} Rules...</span>
                </button>
              </div>
            </div>
          </div>
          <div v-else>Loading...</div>
        </div>
      </DialogPanel>
    </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import dayjs from 'dayjs';
import { Dialog, DialogPanel, TransitionRoot } from '@headlessui/vue';
import emitter from '../emitters/basic';
import { useConfig } from '../stores/config';
import { useCurrency } from '../stores/currency';
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
import { BidAmountFormulaType, DisableBotType } from '@argonprotocol/commander-calculator/src/IBiddingRules.ts';
import numeral, { createNumeralHelpers } from '../lib/numeral';
import { bigIntMax } from '@argonprotocol/commander-calculator/src/utils.ts';
import { MICROGONS_PER_ARGON } from '@argonprotocol/mainchain';

const config = useConfig();
const currency = useCurrency();
const { microgonToArgonNm, microgonToMoneyNm } = createNumeralHelpers(currency);

const isOpen = Vue.ref(false);
const isLoaded = Vue.ref(false);
const isSaving = Vue.ref(false);

const hasExistingRules = Vue.ref(false);

const dialogPanel = Vue.ref(null);
const isShowingBreakdownTooltip = Vue.ref(false);

const requiredMicrogons = Vue.ref(1n);
const requiredMicronots = Vue.ref(1n);

const desiredMicrogons = Vue.ref(1n);
const desiredMicronots = Vue.ref(1n);

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
  {
    title: 'Curious Beginner',
    value: 1,
    description: "Recommended if you're just starting.",
    current: true,
  },
  {
    title: 'Committed Supporter',
    value: 3,
    description: 'Be a major player with multiple seats.',
    current: false,
  },
  {
    title: 'Bold Speculator',
    value: 10,
    description: 'You think argon is going to the moon.',
    current: false,
  },
  {
    title: 'Degenerate Gambler',
    value: 20,
    description: 'We never recommend this to anyone.',
    current: false,
  },
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
  startingOptimisticCalculator.setFutureArgonCirculation(calculatedArgonCirculation.value);
  finalOptimisticCalculator.setFutureArgonCirculation(calculatedArgonCirculation.value);
  updateStartingAmountFormulaPrice();
  updateFinalAmountFormulaPrice();
});

// Argonot Price Change
const micronotPriceChangeType = Vue.ref('Between' as IBiddingRules['micronotPriceChangeType']);
const micronotPriceChangeMin = Vue.ref(0n);
const micronotPriceChangeMax = Vue.ref(0n);

Vue.watch(micronotPriceChangeMin, () => {
  startingMinimumCalculator.setArgonotPriceChangePct(micronotPriceChangeMin.value);
  finalMinimumCalculator.setArgonotPriceChangePct(micronotPriceChangeMin.value);
  updateStartingAmountFormulaPrice();
  updateFinalAmountFormulaPrice();
});

Vue.watch(micronotPriceChangeMax, () => {
  startingOptimisticCalculator.setArgonotPriceChangePct(micronotPriceChangeMax.value);
  finalOptimisticCalculator.setArgonotPriceChangePct(micronotPriceChangeMax.value);
  updateStartingAmountFormulaPrice();
  updateFinalAmountFormulaPrice();
});

// Starting Amount
const startingBidAmountFormulaType = Vue.ref('PrevDayLow' as IBiddingRules['startingBidAmountFormulaType']);
const startingAmountFormulaPrice = Vue.ref<bigint>(0n);
const startingBidAmountAbsolute = Vue.ref<bigint>(0n);
const startingBidAmountRelative = Vue.ref<number>(0);

function updateStartingAmountFormulaPrice() {
  if (startingBidAmountFormulaType.value === BidAmountFormulaType.PreviousDayLow) {
    startingAmountFormulaPrice.value = calculatorData.previousDayLowBid;
  } else if (startingBidAmountFormulaType.value === BidAmountFormulaType.MinimumBreakeven) {
    startingAmountFormulaPrice.value = startingMinimumCalculator.minimumBreakevenBid;
  } else if (startingBidAmountFormulaType.value === BidAmountFormulaType.OptimisticBreakeven) {
    startingAmountFormulaPrice.value = startingOptimisticCalculator.optimisticBreakevenBid;
  }
  updateStartingAmount();
}

function updateStartingAmount() {
  if (startingBidAmountFormulaType.value !== 'Custom') {
    startingBidAmountAbsolute.value = startingAmountFormulaPrice.value * (1n + startingBidAmountAbsolute.value / 100n);
  }

  updateStartingCalculators();
}

function updateStartingCalculators() {
  const txnFee = 1n;
  const seatCount = BigInt(calculatedTotalSeats.value);
  requiredMicrogons.value = bigIntMax(1n, (startingBidAmountRelative.value + txnFee) * seatCount);
  requiredMicronots.value = bigIntMax(1n, (calculatorData.micronotsRequiredForBid + txnFee) * seatCount);

  startingMinimumCalculator.setPrice(startingBidAmountRelative.value);
  startingOptimisticCalculator.setPrice(startingBidAmountRelative.value);

  startingOptimisticAPR.value = startingOptimisticCalculator.minimumAPR;
  startingOptimisticAPY.value = startingOptimisticCalculator.minimumAPY;
  startingOptimisticTDPR.value = startingOptimisticCalculator.minimumTDPR;
  startingMinimumAPR.value = startingMinimumCalculator.minimumAPR;
  startingMinimumTDPR.value = startingMinimumCalculator.minimumTDPR;
}

Vue.watch(startingBidAmountFormulaType, updateStartingAmountFormulaPrice);
Vue.watch(startingBidAmountAbsolute, updateStartingAmount);
Vue.watch(startingBidAmountRelative, updateStartingCalculators);
Vue.watch(calculatedTotalSeats, updateStartingCalculators);

// Rebidding
const incrementAmount = Vue.ref(BigInt(Math.floor(0.01 * MICROGONS_PER_ARGON)));
const rebiddingDelay = Vue.ref(1);

const appliedRecommendedRebiddingSettings = Vue.ref(false);

function applyRecommendedRebiddingSettings() {
  rebiddingDelay.value = 10;
  incrementAmount.value = 5n;
  appliedRecommendedRebiddingSettings.value = true;
}

Vue.watch(rebiddingDelay, () => {
  if (rebiddingDelay.value !== 10) {
    appliedRecommendedRebiddingSettings.value = false;
  }
});

Vue.watch(incrementAmount, () => {
  if (incrementAmount.value !== 5n) {
    appliedRecommendedRebiddingSettings.value = false;
  }
});

// Final Amount
const finalBidAmountRelative = Vue.ref(0);
const finalBidAmountFormulaType = Vue.ref('PrevDayHigh' as IBiddingRules['finalBidAmountFormulaType']);
const finalAmountFormulaPrice = Vue.ref(0n);
const finalBidAmountAbsolute = Vue.ref(0n);

function updateFinalAmountFormulaPrice() {
  if (finalBidAmountFormulaType.value === BidAmountFormulaType.PreviousDayHigh) {
    finalAmountFormulaPrice.value = calculatorData.previousDayHighBid;
  } else if (finalBidAmountFormulaType.value === BidAmountFormulaType.MinimumBreakeven) {
    finalAmountFormulaPrice.value = calculatorData.microgonsToMineThisSeat;
  } else if (finalBidAmountFormulaType.value === BidAmountFormulaType.OptimisticBreakeven) {
    finalAmountFormulaPrice.value = finalOptimisticCalculator.optimisticBreakevenBid;
  }
  updateFinalAmount();
}

function updateFinalAmount() {
  if (finalBidAmountFormulaType.value !== 'Custom') {
    finalBidAmountAbsolute.value = finalAmountFormulaPrice.value * (1n + finalBidAmountAbsolute.value / 100n);
  }

  updateFinalCalculators();
}

function updateFinalCalculators() {
  const txnFee = 1n;
  const seatCount = BigInt(calculatedTotalSeats.value);
  desiredMicrogons.value = bigIntMax(1n, (finalBidAmountAbsolute.value + txnFee) * seatCount);
  desiredMicronots.value = bigIntMax(1n, (calculatorData.micronotsRequiredForBid + txnFee) * seatCount);

  finalMinimumCalculator.setPrice(finalBidAmountRelative.value);
  finalOptimisticCalculator.setPrice(finalBidAmountRelative.value);

  finalOptimisticAPR.value = finalOptimisticCalculator.minimumAPR;
  finalOptimisticTDPR.value = finalOptimisticCalculator.minimumTDPR;
  finalMinimumAPR.value = finalMinimumCalculator.minimumAPR;
  finalMinimumAPY.value = finalMinimumCalculator.minimumAPY;
  finalMinimumTDPR.value = finalMinimumCalculator.minimumTDPR;
}

Vue.watch(finalBidAmountFormulaType, updateFinalAmountFormulaPrice);
Vue.watch(finalBidAmountAbsolute, updateFinalAmount);
Vue.watch(finalBidAmountRelative, updateFinalCalculators);
Vue.watch(calculatedTotalSeats, updateFinalCalculators);

// Throttles
const throttleSeats = Vue.ref(false);
const throttleSeatCount = Vue.ref(1);
const throttleSpending = Vue.ref(false);
const throttleSpendingAmount = Vue.ref(0n);
const throttleDistributeEvenly = Vue.ref(false);
const appliedRecommendedThrottles = Vue.ref(false);

function applyRecommendedThrottles() {
  throttleSeats.value = false;
  throttleSpending.value = false;
  throttleDistributeEvenly.value = true;
  appliedRecommendedThrottles.value = true;
}

// Disable
const disableBotType: Vue.Ref<DisableBotType> = Vue.ref(DisableBotType.Never);

async function saveRules() {
  isSaving.value = true;
  const rules: IBiddingRules = {
    calculatedTotalSeats: calculatedTotalSeats.value,
    calculatedArgonCirculation: calculatedArgonCirculation.value,
    micronotPriceChangeType: micronotPriceChangeType.value,
    micronotPriceChangeMin: micronotPriceChangeMin.value,
    micronotPriceChangeMax: micronotPriceChangeMax.value,

    startingBidAmountFormulaType: startingBidAmountFormulaType.value,
    startingBidAmountAbsolute: startingBidAmountAbsolute.value,
    startingBidAmountRelative: startingBidAmountRelative.value,

    rebiddingDelay: rebiddingDelay.value,
    incrementAmount: incrementAmount.value,

    finalBidAmountFormulaType: finalBidAmountFormulaType.value,
    finalBidAmountAbsolute: finalBidAmountAbsolute.value,
    finalBidAmountRelative: finalBidAmountRelative.value,

    throttleSeats: throttleSeats.value,
    throttleSeatCount: throttleSeatCount.value,

    throttleSpending: throttleSpending.value,
    throttleSpendingAmount: throttleSpendingAmount.value,

    throttleDistributeEvenly: throttleDistributeEvenly.value,

    disableBotType: disableBotType.value,

    requiredMicrogons: requiredMicrogons.value,
    requiredMicronots: requiredMicronots.value,

    desiredMicrogons: desiredMicrogons.value,
    desiredMicronots: desiredMicronots.value,
  };

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
}

function closeOverlay() {
  isOpen.value = false;
  isLoaded.value = false;
}

function showBreakdownTooltip(calculator: BiddingCalculator) {
  isShowingBreakdownTooltip.value = true;
  scenarioData.value = {
    scenarioName: calculator.scenarioName,
    costOfArgonotLoss: calculator.costOfArgonotLossInMicrogons,
    argonotPriceChange: calculator.argonotPriceChangePct,
    micronotsRequiredForBid: calculatorData.micronotsRequiredForBid,
    microgonBidPremium: calculator.microgonBidPremium,
    transactionFee: calculatorData.estimatedTransactionFee,
    microgonRewardsForThisSeat: calculatorData.microgonsToMineThisSeat,
    micronotRewardsForThisSeat: calculatorData.micronotsToMineThisSeat,
    microgonsToMintThisSeat: calculator.microgonsToMintThisSeat,
    micronotRewardsAsMicrogonValue: calculator.micronotRewardsAsMicrogonValue,
    totalCost: calculator.totalCostOfBid,
    totalRewards: calculator.totalRewards,
    TDPR: calculator.minimumTDPR,
    APR: calculator.minimumAPR,
    APY: calculator.minimumAPY,
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
    console.log('openBiddingRulesOverlay');
    const biddingRules = config.biddingRules || undefined;
    hasExistingRules.value = !!biddingRules;
    // calculatedTotalSeats.value = biddingRules?.calculatedTotalSeats || calculatedTotalSeats.value;
    // calculatedArgonCirculation.value = biddingRules?.calculatedArgonCirculation || calculatedArgonCirculation.value;
    // micronotPriceChangeType.value = biddingRules?.micronotPriceChangeType || micronotPriceChangeType.value;
    // micronotPriceChangeMin.value = biddingRules?.micronotPriceChangeMin || micronotPriceChangeMin.value;
    // micronotPriceChangeMax.value = biddingRules?.micronotPriceChangeMax || micronotPriceChangeMax.value;
    // startingBidAmountRelative.value = biddingRules?.startingBidAmountRelative || startingBidAmountRelative.value;
    // startingBidAmountFormulaType.value = biddingRules?.startingBidAmountFormulaType || startingBidAmountFormulaType.value;
    // startingBidAmountAbsolute.value =
    //   biddingRules?.startingBidAmountAbsolute || startingBidAmountAbsolute.value;
    // incrementAmount.value = biddingRules?.incrementAmount || incrementAmount.value;
    // rebiddingDelay.value = biddingRules?.rebiddingDelay || rebiddingDelay.value;
    // finalBidAmountRelative.value = biddingRules?.finalBidAmountRelative || finalBidAmountRelative.value;
    // finalBidAmountFormulaType.value = biddingRules?.finalBidAmountFormulaType || finalBidAmountFormulaType.value;
    // finalBidAmountAbsolute.value = biddingRules?.finalBidAmountAbsolute || finalBidAmountAbsolute.value;
    // throttleSeats.value = biddingRules?.throttleSeats || throttleSeats.value;
    // throttleSeatCount.value = biddingRules?.throttleSeatCount || throttleSeatCount.value;
    // throttleSpending.value = biddingRules?.throttleSpending || throttleSpending.value;
    // throttleSpendingAmount.value = biddingRules?.throttleSpendingAmount || throttleSpendingAmount.value;
    // throttleDistributeEvenly.value = biddingRules?.throttleDistributeEvenly || throttleDistributeEvenly.value;
    // disableBotType.value = biddingRules?.disableBotType || disableBotType.value;

    isLoaded.value = true;
    calculatedArgonCirculationMin.value = Math.ceil(
      Number(calculatorData.microgonsMinedThisNextYear) / MICROGONS_PER_ARGON,
    );

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
