import * as Vue from 'vue'
import { defineStore } from 'pinia'
import mainchain from '../lib/Mainchain';

export const useBlockchainStore = defineStore('blockchain', () => {
  const recentBlocks = Vue.reactive<any[]>([]);
  const recentBlocksAreLoaded = Vue.ref(false);
  const lastBlockTimestamp = Vue.ref(0);

  const miningSeatCount = Vue.ref(0);
  const aggregateBidCosts = Vue.ref(0);
  const minimumBlockRewards = Vue.ref(70_981);
  const currentAPR = Vue.ref(0);
  const currentAPY = Vue.ref(0);
  
  async function addRecentBlock(client: any, blockHash: any) {
    const block = await client.derive.chain.getBlock(blockHash);
    const events = await client.query.system.events.at(blockHash);
    const blockRewardEvent = events.filter(({ event }: { event: any }) => event.section === "blockRewards" && event.method === "RewardCreated")[0];
    const argonots = (blockRewardEvent?.event?.data[1][0].ownership.toNumber() / 1_000_000).toFixed(2);
    const argons = (blockRewardEvent?.event?.data[1][0].argons.toNumber() / 1_000_000).toFixed(2);
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
    const client = await mainchain.client;

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
    await client.rpc.chain.subscribeNewHeads(async (header) => {
      const blockHash = header.hash;
      addRecentBlock(client, blockHash);
    });

    recentBlocks.sort((a, b) => a.number - b.number);
  }
  
  function calculateAnnualPercentageRate(aggregateBidCosts: number, minimumBlockRewards: number) {
    const tenDayRate = (minimumBlockRewards - aggregateBidCosts) / aggregateBidCosts;
    return tenDayRate * 36.5 * 100;
  }

  function calculateAnnualPercentageYield(aggregateBidCosts: number, minimumBlockRewards: number) {
    const tenDayRate = (minimumBlockRewards - aggregateBidCosts) / aggregateBidCosts;
    // Compound APR over 36.5 cycles (10-day periods in a year)
    const apy = (Math.pow(1 + tenDayRate, 36.5) - 1) * 100;
    if (apy > 9999) {
      return 9999;
    }
    return apy;
  }

  async function fetchMiningSeatCount() {
    miningSeatCount.value = await mainchain.getMiningSeatCount();
  }

  async function fetchAggregateBidCosts() {
    aggregateBidCosts.value = await mainchain.getAggregateBidCosts();
  }

  async function initialize() {
    await Promise.all([
      subscribeToRecentBlocks(),
      fetchAggregateBidCosts(),
      fetchMiningSeatCount(),
    ]);
    currentAPR.value = calculateAnnualPercentageRate(aggregateBidCosts.value, minimumBlockRewards.value);
    currentAPY.value = calculateAnnualPercentageYield(aggregateBidCosts.value, minimumBlockRewards.value);
  }

  initialize();

  return { recentBlocks, recentBlocksAreLoaded, lastBlockTimestamp, aggregateBidCosts, miningSeatCount, minimumBlockRewards, currentAPR, currentAPY }
});