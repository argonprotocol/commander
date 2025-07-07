import * as Vue from 'vue';
import { defineStore } from 'pinia';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import relativeTime from 'dayjs/plugin/relativeTime';
import { type MainchainClient } from '@argonprotocol/commander-calculator';
import { getMainchain, getMainchainClient } from '../stores/mainchain.ts';
import { BlockHash } from '@argonprotocol/mainchain';

dayjs.extend(utc);
dayjs.extend(relativeTime);

export type IActiveBid = {
  cohortId: number;
  accountId: string;
  amount: number;
  submittedAt: dayjs.Dayjs;
  isMine?: boolean;
};

export type IBlock = {
  number: number;
  hash: string;
  author: string;
  extrinsics: number;
  microgons: bigint;
  micronots: bigint;
  timestamp: Dayjs;
};

export const useBlockchainStore = defineStore('blockchain', () => {
  const miningSeatCount = Vue.ref(0);
  const aggregatedBidCosts = Vue.ref(0n);
  const aggregatedBlockRewards = Vue.ref({ microgons: 0n, micronots: 0n });

  const cachedBlockLoading = { hash: null } as unknown as IBlock;
  const cachedBlocks = Vue.ref<IBlock[]>([
    cachedBlockLoading,
    cachedBlockLoading,
    cachedBlockLoading,
    cachedBlockLoading,
    cachedBlockLoading,
    cachedBlockLoading,
    cachedBlockLoading,
    cachedBlockLoading,
  ]);

  function extractBlockRewardsFromEvent(blockRewardEvent: any) {
    if (!blockRewardEvent) {
      return { microgons: 0n, micronots: 0n };
    }
    const micronots = blockRewardEvent?.event?.data.rewards[0].ownership.toBigInt();
    const microgons = blockRewardEvent?.event?.data.rewards[0].argons.toBigInt();
    return { microgons, micronots };
  }

  async function fetchBlock(client: MainchainClient, blockHash: BlockHash) {
    const block = await client.derive.chain.getBlock(blockHash);
    const events = await client.query.system.events.at(blockHash);
    const blockRewardEvent = events.filter(({ event }: { event: any }) =>
      client.events.blockRewards.RewardCreated.is(event),
    )[0];
    const { microgons, micronots } = extractBlockRewardsFromEvent(blockRewardEvent);
    const timestamp = (await client.query.timestamp.now.at(blockHash)).toNumber();
    const newBlock: IBlock = {
      number: block.block.header.number.toNumber(),
      hash: block.block.header.hash.toHex(),
      author: block.author?.toHex() || '',
      extrinsics: block.block.extrinsics.length,
      microgons,
      micronots,
      timestamp: dayjs.utc(timestamp),
    };

    return newBlock;
  }

  async function fetchBlocks(lastBlockNumber: number | null, endingFrameId: number | null, maxBlockCount: number) {
    const client = await getMainchainClient();
    const blocks: IBlock[] = [];

    if (!lastBlockNumber) {
      const lastestBlockHash = await client.rpc.chain.getHeader();
      const lastestBlock = await client.rpc.chain.getBlock(lastestBlockHash.hash);
      lastBlockNumber = lastestBlock.block.header.number.toNumber();
    }

    let blockNumber = lastBlockNumber;
    while (blocks.length < maxBlockCount) {
      const blockHash = await client.rpc.chain.getBlockHash(blockNumber);
      if (!blockHash) break;
      const block = await fetchBlock(client, blockHash);
      blocks.push(block);
      blockNumber--;
    }

    return blocks;
  }

  async function subscribeToBlocks(onBlock: (block: IBlock) => void) {
    const client = await getMainchainClient();

    // Subscribe to new blocks
    return await client.rpc.chain.subscribeNewHeads(async header => {
      const blockHash = header.hash;
      const block = await fetchBlock(client, blockHash);
      onBlock(block);
    });
  }

  async function unsubscribeFromBlocks(subscription: any) {
    subscription.unsubscribe();
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
    aggregatedBidCosts,
    aggregatedBlockRewards,
    miningSeatCount,
    cachedBlocks,
    subscribeToBlocks,
    unsubscribeFromBlocks,
    updateAggregateBidCosts,
    updateAggregateBlockRewards,
    updateMiningSeatCount,
    fetchBlocks,
  };
});
