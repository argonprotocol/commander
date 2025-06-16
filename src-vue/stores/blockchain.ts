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
  argonots: number;
  argons: number;
  timestamp: Dayjs;
};

export const useBlockchainStore = defineStore('blockchain', () => {
  const miningSeatCount = Vue.ref(0);
  const aggregatedBidCosts = Vue.ref(0);
  const aggregatedBlockRewards = Vue.ref({ argons: 0, argonots: 0 });

  function extractBlockRewardsFromEvent(blockRewardEvent: any) {
    if (!blockRewardEvent) {
      return { argons: 0, argonots: 0 };
    }
    const argonots = Number(
      (blockRewardEvent?.event?.data.rewards[0].ownership.toNumber() / 1_000_000).toFixed(2),
    );
    const argons = Number(
      (blockRewardEvent?.event?.data.rewards[0].argons.toNumber() / 1_000_000).toFixed(2),
    );
    return { argons, argonots };
  }

  async function fetchBlock(client: MainchainClient, blockHash: BlockHash) {
    console.log('fetchBlock', blockHash);
    const block = await client.derive.chain.getBlock(blockHash);
    const events = await client.query.system.events.at(blockHash);
    const blockRewardEvent = events.filter(({ event }: { event: any }) =>
      client.events.blockRewards.RewardCreated.is(event),
    )[0];
    const { argons, argonots } = extractBlockRewardsFromEvent(blockRewardEvent);
    const timestamp = (await client.query.timestamp.now.at(blockHash)).toNumber();
    const newBlock: IBlock = {
      number: block.block.header.number.toNumber(),
      hash: block.block.header.hash.toHex(),
      author: block.author?.toHex() || '',
      extrinsics: block.block.extrinsics.length,
      argonots,
      argons,
      timestamp: dayjs.utc(timestamp),
    };

    return newBlock;
  }

  async function fetchBlocks(
    lastBlockNumber: number | null,
    endingFrameId: number | null,
    maxBlockCount: number,
  ) {
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
    subscribeToBlocks,
    unsubscribeFromBlocks,
    updateAggregateBidCosts,
    updateAggregateBlockRewards,
    updateMiningSeatCount,
    fetchBlocks,
  };
});
