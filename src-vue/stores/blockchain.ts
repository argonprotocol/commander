import * as Vue from 'vue';
import { defineStore } from 'pinia';
import dayjs, { extend as dayJsExtend, Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import relativeTime from 'dayjs/plugin/relativeTime';
import { type MainchainClient } from '@argonprotocol/commander-core';
import { getMainchain, getMainchainClient } from './mainchain.ts';
import { BlockHash, getAuthorFromHeader } from '@argonprotocol/mainchain';

dayJsExtend(utc);
dayJsExtend(relativeTime);

export type IActiveBid = {
  cohortId: number;
  accountId: string;
  amount: number;
  submittedAt: Dayjs;
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

  async function fetchBlock(client: MainchainClient, blockHash: BlockHash) {
    const header = await client.rpc.chain.getHeader(blockHash);
    const author = getAuthorFromHeader(client, header);
    const clientAt = await client.at(blockHash);
    const events = await clientAt.query.system.events();
    const extrinsics = await clientAt.query.system.extrinsicCount().then(x => (x.isSome ? x.value.toNumber() : 0));
    const blockRewards = events.map(({ event }: { event: any }) => {
      if (client.events.blockRewards.RewardCreated.is(event)) {
        return event.data.rewards.map(x => ({
          micronots: x.ownership.toBigInt(),
          microgons: x.argons.toBigInt(),
          accountId: x.accountId.toHuman(),
          isMining: x.rewardType.isMiner,
          isVote: x.rewardType.isVoter,
        }));
      }
    })[0];
    const { microgons, micronots } = blockRewards?.find(x => x.isMining) ?? { microgons: 0n, micronots: 0n };
    const timestamp = (await clientAt.query.timestamp.now()).toNumber();
    const newBlock: IBlock = {
      number: header.number.toNumber(),
      hash: header.hash.toHex(),
      author: author ?? '',
      extrinsics,
      microgons,
      micronots,
      timestamp: dayjs.utc(timestamp),
    };

    return newBlock;
  }

  async function fetchBlocks(lastBlockNumber: number | null, endingFrameId: number | null, maxBlockCount: number) {
    const client = await getMainchainClient(true);
    const blocks: IBlock[] = [];

    if (lastBlockNumber === null) {
      const latestBlock = await client.rpc.chain.getHeader();
      lastBlockNumber = latestBlock.number.toNumber();
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
    const client = await getMainchainClient(false);

    // Subscribe to new blocks
    return await client.rpc.chain.subscribeNewHeads(async header => {
      const blockHash = header.hash;
      const block = await fetchBlock(client, blockHash);
      onBlock(block);
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
    aggregatedBidCosts,
    aggregatedBlockRewards,
    miningSeatCount,
    cachedBlocks,
    subscribeToBlocks,
    updateAggregateBidCosts,
    updateAggregateBlockRewards,
    updateMiningSeatCount,
    fetchBlocks,
  };
});
