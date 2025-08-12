import { runOnTeardown, sudo, teardown } from '@argonprotocol/testing';
import { FrameCalculator, getClient, mnemonicGenerate } from '@argonprotocol/mainchain';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import Path from 'node:path';
import Bot from '../src/Bot.ts';
import * as BiddingCalculator from '@argonprotocol/commander-calculator';
import { Dockers } from '../src/Dockers.js';
import { startNetwork } from './_network.js';

afterEach(teardown);
afterAll(teardown);

let clientAddress: string;
beforeAll(async () => {
  const result = await startNetwork();
  clientAddress = result.archiveUrl;
});

it('can autobid and store stats', async () => {
  const client = await getClient(clientAddress);

  const botDataDir = fs.mkdtempSync('/tmp/bot-');

  runOnTeardown(() => fs.promises.rm(botDataDir, { recursive: true, force: true }));

  vi.spyOn(BiddingCalculator, 'createBidderParams').mockImplementation(async () => {
    return {
      maxSeats: 10,
      bidDelay: 0,
      maxBudget: 100_000_000n,
      maxBid: 1_000_000n,
      minBid: 10_000n,
      bidIncrement: 10_000n,
    };
  });

  vi.spyOn(Bot.prototype as any, 'loadBiddingRules').mockImplementation(() => {
    /* return an empty object so it's not undefined */
    return {};
  });

  vi.spyOn(Dockers, 'getArgonBlockNumbers').mockImplementation(async () => {
    return {
      localNode: 0,
      mainNode: 0,
    };
  });
  vi.spyOn(Dockers, 'getBitcoinBlockNumbers').mockImplementation(async () => {
    return {
      localNode: 0,
      mainNode: 0,
    };
  });

  const bot = new Bot({
    pair: sudo(),
    archiveRpcUrl: clientAddress,
    localRpcUrl: clientAddress,
    biddingRulesPath: Path.resolve(botDataDir, 'rules.json'),
    datadir: botDataDir,
    keysMnemonic: mnemonicGenerate(),
    shouldSkipDockerSync: true,
  });

  await expect(bot.start()).resolves.toBeUndefined();
  const status = await bot.blockSync.state();
  expect(status.lastBlockNumber).toBeGreaterThanOrEqual(status.lastFinalizedBlockNumber);
  console.log(status);
  let firstCohortActivationFrameId = 1;

  console.log('Waiting for first rotation');
  // wait for the first rotation
  await new Promise(async resolve => {
    console.log('Waiting for activeMinersCount');
    const unsubscribe = await client.query.miningSlot.activeMinersCount(async x => {
      if (x.toNumber() > 0) {
        unsubscribe();
        firstCohortActivationFrameId = await client.query.miningSlot.nextFrameId().then(x => x.toNumber() - 1);
        resolve(x);
      }
    });
    console.log('Set up activeMinersCount');
  });

  console.log('First rotation found', firstCohortActivationFrameId);

  let voteBlocks = 0;
  let lastFinalizedBlockNumber = 0;
  const cohortActivationFrameIdsWithEarnings = new Set<number>();
  // wait for first finalized vote block
  await new Promise(async resolve => {
    const unsubscribe = await client.rpc.chain.subscribeFinalizedHeads(async x => {
      const api = await client.at(x.hash);
      const isVoteBlock = await api.query.blockSeal.isBlockFromVoteSeal().then(x => x.isTrue);
      lastFinalizedBlockNumber = x.number.toNumber();
      if (isVoteBlock) {
        console.log(`Block ${x.number} is vote block`);
        const frameId = await new FrameCalculator().getForHeader(client, x);
        if (frameId !== undefined) cohortActivationFrameIdsWithEarnings.add(frameId);
        voteBlocks++;
        if (voteBlocks > 5) {
          unsubscribe();
          resolve(x);
        }
      }
    });
  });

  console.log(
    `Rotations with earnings: ${[...cohortActivationFrameIdsWithEarnings]}. First cohort ${firstCohortActivationFrameId}`,
  );
  expect(cohortActivationFrameIdsWithEarnings.size).toBeGreaterThan(0);

  const firstCohortBiddingFrameId = firstCohortActivationFrameId - 1;
  const cohort1Bids = await bot.storage.bidsFile(firstCohortBiddingFrameId, firstCohortActivationFrameId).get();
  expect(cohort1Bids).toBeTruthy();
  console.log(`Cohort 1`, cohort1Bids);
  expect(cohort1Bids?.micronotsStakedPerSeat).toBeGreaterThanOrEqual(10000);
  expect(cohort1Bids?.seatsWon).toBe(10);
  expect(cohort1Bids?.microgonsBidTotal).toBe(10_000n * 10n);

  // wait for sync state to equal latest finalized
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 100));
    const status = await bot.blockSync.state();
    if (status.lastBlockNumber >= lastFinalizedBlockNumber) break;
  }

  const cohortActivationFrameIds = new Set<number>();
  let microgonsMined = 0n;
  for (const frameId of cohortActivationFrameIdsWithEarnings) {
    const earningsData = await bot.storage.earningsFile(frameId!).get();
    expect(earningsData).toBeDefined();
    expect(Object.keys(earningsData!.earningsByBlock).length).toBeGreaterThanOrEqual(1);
    for (const blockEarnings of Object.values(earningsData!.earningsByBlock)) {
      expect(blockEarnings.authorCohortActivationFrameId).toBeGreaterThan(0);
      cohortActivationFrameIds.add(blockEarnings.authorCohortActivationFrameId);
      expect(blockEarnings.microgonsMined).toBeGreaterThan(0n);
      microgonsMined += blockEarnings.microgonsMined;
    }
  }
  expect(microgonsMined).toBeGreaterThanOrEqual(375_000 * voteBlocks);

  // wait for a clean stop
  const lastProcessed = bot.blockSync.lastProcessed;
  await new Promise(resolve => {
    bot.blockSync.didProcessFinalizedBlock = x => {
      if (x.frameId > lastProcessed!.frameId) {
        resolve(x);
      }
    };
  });
  console.log('Stopping bot 1', {
    cohortActivationFrameIdsWithEarnings: [...cohortActivationFrameIdsWithEarnings],
    cohortActivationFrameIds: [...cohortActivationFrameIds],
  });
  await bot.shutdown();

  // try to recover from blocks

  const path2 = fs.mkdtempSync('/tmp/bot2-');
  runOnTeardown(() => fs.promises.rm(path2, { recursive: true, force: true }));
  const botRestart = new Bot({
    pair: sudo(),
    archiveRpcUrl: clientAddress,
    localRpcUrl: clientAddress,
    biddingRulesPath: Path.resolve(botDataDir, 'rules.json'),
    datadir: path2,
    keysMnemonic: mnemonicGenerate(),
    oldestFrameIdToSync: Math.min(...cohortActivationFrameIds) - 1,
    shouldSkipDockerSync: true,
  });
  console.log('Starting bot 2');
  await expect(botRestart.start()).resolves.toBeUndefined();
  console.log('Stopping bot 2');
  await botRestart.shutdown();

  // compare directories
  for (const cohortActivationFrameId of cohortActivationFrameIdsWithEarnings) {
    const earningsFile1 = await bot.storage.earningsFile(cohortActivationFrameId).get();
    const earningsFile2 = await botRestart.storage.earningsFile(cohortActivationFrameId).get();
    console.info('Checking earnings for frameId', cohortActivationFrameId);
    expect(earningsFile1).toBeTruthy();
    expect(earningsFile2).toBeTruthy();
    expect(earningsFile1!).toEqual(earningsFile2!);
  }

  for (const cohortActivationFrameId of cohortActivationFrameIds) {
    const cohortBiddingFrameId = cohortActivationFrameId - 1;
    const bidsFile1 = await bot.storage.bidsFile(cohortBiddingFrameId, cohortActivationFrameId).get();
    const bidsFile2 = await botRestart.storage.bidsFile(cohortBiddingFrameId, cohortActivationFrameId).get();
    console.info('Checking bidding for cohort', cohortActivationFrameId);
    expect(bidsFile1).toBeTruthy();
    expect(bidsFile2).toBeTruthy();
    expect(bidsFile1!).toEqual(bidsFile2!);
  }
}, 180e3);
