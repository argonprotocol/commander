import * as Vue from 'vue';
import { defineStore } from 'pinia';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import relativeTime from 'dayjs/plugin/relativeTime';
import { type MainchainClient } from '@argonprotocol/commander-calculator';
import { type UnsubscribePromise } from '@polkadot/api-base/types/base';
import { getMainchain, getMainchainClient } from '../stores/mainchain.ts';

dayjs.extend(utc);
dayjs.extend(relativeTime);

export type IActiveBid = {
  cohortId: number;
  accountId: string;
  amount: number;
  submittedAt: dayjs.Dayjs;
  isMine?: boolean;
};

export const useBlockchainStore = defineStore('blockchain', () => {
  const recentBlocks = Vue.reactive<any[]>([]);
  const recentBlocksAreLoaded = Vue.ref(false);
  const lastBlockTimestamp = Vue.ref(0);

  const miningSeatCount = Vue.ref(0);
  const aggregatedBidCosts = Vue.ref(0);
  const aggregatedBlockRewards = Vue.ref({ argons: 0, argonots: 0 });

  function extractBlockRewardsFromEvent(blockRewardEvent: any) {
    if (!blockRewardEvent) {
      return { argons: 0, argonots: 0 };
    }
    const argonots = (
      blockRewardEvent?.event?.data.rewards[0].ownership.toNumber() / 1_000_000
    ).toFixed(2);
    const argons = (blockRewardEvent?.event?.data.rewards[0].argons.toNumber() / 1_000_000).toFixed(
      2,
    );
    return { argons, argonots };
  }

  async function addRecentBlock(client: MainchainClient, blockHash: any) {
    const block = await client.derive.chain.getBlock(blockHash);
    const events = await client.query.system.events.at(blockHash);
    const blockRewardEvent = events.filter(({ event }: { event: any }) =>
      client.events.blockRewards.RewardCreated.is(event),
    )[0];
    const { argons, argonots } = extractBlockRewardsFromEvent(blockRewardEvent);

    const timestamp = await client.query.timestamp.now.at(blockHash);
    lastBlockTimestamp.value = timestamp.toNumber();

    const newBlock = {
      number: block.block.header.number.toNumber(),
      hash: block.block.header.hash.toHex(),
      author: block.author?.toHex(),
      extrinsics: block.block.extrinsics.length,
      argonots,
      argons,
      timestamp: lastBlockTimestamp,
    };
    recentBlocks.push(newBlock);
    if (recentBlocks.length > 6) {
      recentBlocks.shift();
    }
  }

  async function subscribeToRecentBlocks() {
    const client = await getMainchainClient();

    // Initial load of recent blocks
    const lastBlockHash = await client.rpc.chain.getHeader();
    const lastBlock = await client.rpc.chain.getBlock(lastBlockHash.hash);
    const lastBlockNumber = lastBlock.block.header.number.toNumber();
    const sinceBlockNumber = lastBlockNumber - 6;

    for (let blockNumber = sinceBlockNumber; blockNumber <= lastBlockNumber; blockNumber++) {
      const blockHash = await client.rpc.chain.getBlockHash(blockNumber);
      await addRecentBlock(client, blockHash);
    }

    recentBlocksAreLoaded.value = true;

    // Subscribe to new blocks
    await client.rpc.chain.subscribeNewHeads(async header => {
      const blockHash = header.hash;
      addRecentBlock(client, blockHash);
    });

    recentBlocks.sort((a, b) => a.number - b.number);
  }

  async function subscribeToActiveBids(
    callbackFn: (activeBids: IActiveBid[]) => void,
  ): UnsubscribePromise {
    const client = await getMainchainClient();
    return client.query.miningSlot.nextSlotCohort(nextSlotCohort => {
      const newBids: IActiveBid[] = [];
      for (const bid of nextSlotCohort) {
        newBids.push({
          cohortId: bid.cohortId.toNumber(),
          accountId: bid.accountId.toString(),
          amount: bid.bid.toNumber() / 1_000_000,
          submittedAt: dayjs.utc(bid.bidAtTick.toNumber() * 60_000),
        });
      }
      callbackFn(newBids);
    });
  }

  async function updateMiningSeatCount() {
    miningSeatCount.value = await getMainchain().getMiningSeatCount();
  }

  async function updateAggregateBidCosts() {
    aggregatedBidCosts.value = await getMainchain().getAggregateBidCosts();
  }

  async function updateAggregateBlockRewards() {
    aggregatedBlockRewards.value = await getMainchain().getAggregateBlockRewards();
  }

  return {
    recentBlocks,
    recentBlocksAreLoaded,
    lastBlockTimestamp,
    aggregatedBidCosts,
    aggregatedBlockRewards,
    miningSeatCount,
    subscribeToRecentBlocks,
    updateAggregateBidCosts,
    updateAggregateBlockRewards,
    updateMiningSeatCount,
    subscribeToActiveBids,
  };
});
