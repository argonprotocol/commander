<!-- prettier-ignore -->
<template>
  <Popover as="div" class="relative">
    <PopoverButton class="focus:outline-none">
      <slot>
        <span class="border border-argon-300 text-center text-lg font-bold mt-10 whitespace-nowrap text-argon-600 px-7 py-2 rounded cursor-pointer hover:bg-argon-50/40 hover:border-argon-600 transition-all duration-300">
          View Bidding Activity
        </span>
      </slot>
    </PopoverButton>
    <PopoverPanel as="div" :class="panelPositioningClasses" class="absolute cursor-default w-220 z-100 text-center text-lg font-bold mt-10 bg-white rounded-lg shadow-lg border border-gray-300">
      <div :class="arrowPositioningClasses" class="absolute w-[30px] h-[15px] overflow-hidden">
        <div class="relative top-[5px] left-[5px] w-[20px] h-[20px] rotate-45 bg-white ring-1 ring-gray-900/20"></div>
      </div>
      <div class="flex flex-col text-base px-6 pt-4 pb-2 h-full overflow-hidden">
        <h2 class="text-left text-2xl font-bold mb-2">Recent Bidding Activity</h2>
        <table class="w-full grow font-mono text-md">
          <tbody class="font-light text-left">
            <tr v-for="activity of activities" :key="activity.id">
              <td class="text-left">
                <ActivityArrowIcon v-if="activity.type === 'bidUp'" class="w-5 h-5 text-green-500" />
                <ActivityArrowIcon v-if="activity.type === 'bidDown'" class="w-5 h-5 rotate-180 text-red-500" />
                <ActivityFailureIcon v-if="activity.type === 'failure'" class="w-5 h-5 text-red-500" />
                <ActivitySuccessIcon v-if="activity.type === 'success'" class="w-5 h-5 text-green-500" />
              </td>
              <td class="text-left opacity-50 pl-[5%]">
                {{ activity.timestamp.fromNow() }}
              </td>
              <template v-if="['bidUp', 'bidDown'].includes(activity.type)">
                <td class="pl-[5%]">{{ activity.message }}</td>
                <td class="text-left relative pl-[5%] opacity-50">
                  <div v-if="activity.bidderAddress">
                    {{ activity.bidderAddress.slice(0, 10) }}&nbsp;
                    <span v-if="activity.isMine" class="absolute right-0 top-1/2 -translate-y-1/2 bg-argon-600 text-white px-1.5 pb-0.25 rounded text-sm">
                      YOU
                      <span class="absolute top-0 -left-3 inline-block h-full bg-gradient-to-r from-transparent to-white w-3"></span>
                    </span>
                  </div>
                </td>
              </template>
              <td v-else colspan="2" class="pl-[5%]">
                {{ activity.message }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </PopoverPanel>
  </Popover>
</template>

<script setup lang="ts">
import * as Vue from 'vue';
import { useCurrency } from '../stores/currency';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
import { createNumeralHelpers } from '../lib/numeral';
import { useStats } from '../stores/stats';
import { useConfig } from '../stores/config';
import { Accountset, Keyring } from '@argonprotocol/mainchain';
import ActivityArrowIcon from '../assets/activity-arrow.svg?component';
import ActivityFailureIcon from '../assets/activity-failure.svg?component';
import ActivitySuccessIcon from '../assets/activity-success.svg?component';
import { getMainchainClient } from '../stores/mainchain';
import { BotActivityType } from '@argonprotocol/commander-bot';
import { IBotActivityRecord } from '../interfaces/db/IBotActivityRecord';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  IBotActivityBidReceived,
  IBotActivityBidsSubmitted,
  IBotActivitySeatReduction,
} from '@argonprotocol/commander-bot/src/interfaces/IHistoryFile';

dayjs.extend(utc);
dayjs.extend(relativeTime);

const props = withDefaults(
  defineProps<{
    position?: 'left' | 'top';
  }>(),
  {
    position: 'top',
  },
);

const stats = useStats();
const config = useConfig();
const currency = useCurrency();
const clientPromise = getMainchainClient();

const { microgonToMoneyNm } = createNumeralHelpers(currency);

const panelPositioningClasses = Vue.computed(() => {
  if (props.position === 'left') {
    return 'top-[-140px] right-[calc(100%+10px)] h-160 ';
  } else {
    // props.position === 'top'
    return 'top-[-55px] left-1/2 -translate-x-1/2 -translate-y-full h-140';
  }
});

const arrowPositioningClasses = Vue.computed(() => {
  if (props.position === 'left') {
    return 'top-[122px] right-0 translate-x-[22.5px] -translate-y-full rotate-90';
  } else {
    // props.position === 'top'
    return 'top-full left-1/2 -translate-x-1/2 rotate-180';
  }
});

const walletMiningJson = JSON.parse(config.security.walletJson);
const walletMiningAccount = new Keyring().createFromJson(walletMiningJson);
walletMiningAccount.decodePkcs8(''); // TODO: Need to use passphrase when feature is added
const accountset = new Accountset({
  client: clientPromise,
  seedAccount: walletMiningAccount,
  sessionKeyMnemonic: config.security.sessionMnemonic,
  subaccountRange: new Array(99).fill(0).map((_, i) => i),
});

const activities = Vue.computed(() => {
  return stats.biddingActivity.map(activity => {
    const id = activity.id;
    const type = extractBidType(activity);
    const bidderAddress = activity.data.bidderAddress;
    const isMine = !!accountset.subAccountsByAddress[bidderAddress];
    const timestamp = activity.tick * 60 * 1000;
    const message = extractMessage(activity);
    return {
      id,
      type,
      bidderAddress,
      isMine,
      timestamp: dayjs.utc(timestamp),
      message,
    };
  });
});

function extractMessage(activity: IBotActivityRecord): string {
  if (activity.type === BotActivityType.BidReceived) {
    const { bidPosition, previousBidPosition, microgonsBid, previousMicrogonsBid } =
      activity.data as IBotActivityBidReceived;
    if (previousBidPosition === undefined || previousBidPosition === null) {
      return `A new bid of ${currency.symbol}${microgonToMoneyNm(microgonsBid).format('0,0.00')} was inserted at position #${(bidPosition || 0) + 1}`;
    } else if (bidPosition === undefined || bidPosition === null) {
      return `An existing bid #${previousBidPosition + 1} (${currency.symbol}${microgonToMoneyNm(microgonsBid ?? 0n).format('0,0.00')}) fell off the list`;
    } else if (bidPosition > previousBidPosition) {
      return `An existing bid #${previousBidPosition + 1} (${currency.symbol}${microgonToMoneyNm(microgonsBid ?? 0n).format('0,0.00')}) rose to position #${bidPosition + 1}`;
    } else {
      // bidPosition < previousBidPosition
      return `An existing bid #${previousBidPosition + 1} (${currency.symbol}${microgonToMoneyNm(previousMicrogonsBid ?? 0n).format('0,0.00')}) fell to position #${bidPosition + 1}`;
    }
  } else if (activity.type === BotActivityType.BidsSubmitted) {
    const { microgonsPerSeat, txFeePlusTip, submittedCount } = activity.data as IBotActivityBidsSubmitted;
    return `${submittedCount} new bids were submitted for ${currency.symbol}${microgonToMoneyNm(microgonsPerSeat).format('0,0.00')} per seat`;
  } else if (activity.type === BotActivityType.SeatReduction) {
    const { prevSeatsInPlay, maxSeatsInPlay } = activity.data as IBotActivitySeatReduction;
    return `The number of seats you can win dropped from ${prevSeatsInPlay} to ${maxSeatsInPlay}`;
  }

  return activity.type;
}

function extractBidType(activity: IBotActivityRecord): 'bidUp' | 'bidDown' | 'failure' | 'success' | 'unknown' {
  const successTypes = [
    BotActivityType.Starting,
    BotActivityType.DockersConfirmed,
    BotActivityType.StartedSyncing,
    BotActivityType.FinishedSyncing,
    BotActivityType.Ready,
    BotActivityType.AuctionStarted,
    BotActivityType.AuctionFinished,
    BotActivityType.BidsSubmitted,
    BotActivityType.SeatExpansion,
  ];
  const failureTypes = [
    BotActivityType.Shutdown,
    BotActivityType.Error,
    BotActivityType.BidsRejected,
    BotActivityType.SeatReduction,
  ];

  if (successTypes.includes(activity.type)) {
    return 'success';
  } else if (failureTypes.includes(activity.type)) {
    return 'failure';
  }

  if (activity.type === BotActivityType.BidReceived) {
    if (activity.data.bidPosition === undefined || activity.data.bidPosition === null) {
      return 'bidDown';
    } else if (activity.data.previousBidPosition === undefined || activity.data.previousBidPosition === null) {
      return 'bidUp';
    } else if (activity.data.bidPosition > activity.data.previousBidPosition) {
      return 'bidUp';
    } else {
      return 'bidDown';
    }
  }

  return 'unknown';
}
</script>

<style scoped>
@reference "../main.css";

table td {
  @apply border-t border-gray-300 py-0.5;
}
</style>
