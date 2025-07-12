import { activateNotary, runOnTeardown, sudo, teardown, TestMainchain, TestNotary } from '@argonprotocol/testing';
import { FrameCalculator, mnemonicGenerate } from '@argonprotocol/mainchain';
import { afterAll, afterEach, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import Path from 'node:path';
import Bot from '../src/Bot.ts';
import * as BiddingCalculator from '@argonprotocol/commander-calculator';

afterEach(teardown);
afterAll(teardown);

it('can autobid and store stats', async () => {
  const chain = new TestMainchain();
  await chain.launch({ miningThreads: 1 });
  const notary = new TestNotary();
  await notary.start({
    uuid: chain.uuid,
    mainchainUrl: chain.address,
  });
  const clientPromise = chain.client();
  const client = await clientPromise;
  await activateNotary(sudo(), client, notary);

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

  const bot = new Bot({
    pair: sudo(),
    archiveRpcUrl: chain.address,
    localRpcUrl: chain.address,
    biddingRulesPath: Path.resolve(botDataDir, 'rules.json'),
    datadir: botDataDir,
    keysMnemonic: mnemonicGenerate(),
    shouldSkipDockerSync: true,
  });

  await expect(bot.start()).resolves.toBeUndefined();
  const status = await bot.blockSync.state();
  expect(status.lastBlockNumber).toBeGreaterThanOrEqual(status.lastFinalizedBlockNumber);
  console.log(status);
  let firstCohort = 1;

  console.log('Waiting for first rotation');
  // wait for the first rotation
  await new Promise(async resolve => {
    console.log('Waiting for activeMinersCount');
    const unsubscribe = await client.query.miningSlot.activeMinersCount(async x => {
      if (x.toNumber() > 0) {
        unsubscribe();
        firstCohort = await client.query.miningSlot.nextFrameId().then(x => x.toNumber() - 1);
        resolve(x);
      }
    });
    console.log('Set up activeMinersCount');
  });

  console.log('First rotation found', firstCohort);

  let voteBlocks = 0;
  let lastFinalizedBlockNumber = 0;
  const cohortActivatingFrameIdsWithEarnings = new Set<number>();
  // wait for first finalized vote block
  await new Promise(async resolve => {
    const unsubscribe = await client.rpc.chain.subscribeFinalizedHeads(async x => {
      const api = await client.at(x.hash);
      const isVoteBlock = await api.query.blockSeal.isBlockFromVoteSeal().then(x => x.isTrue);
      lastFinalizedBlockNumber = x.number.toNumber();
      if (isVoteBlock) {
        console.log(`Block ${x.number} is vote block`);
        const frameId = await new FrameCalculator().getForHeader(client, x);
        if (frameId !== undefined) cohortActivatingFrameIdsWithEarnings.add(frameId);
        voteBlocks++;
        if (voteBlocks > 5) {
          unsubscribe();
          resolve(x);
        }
      }
    });
  });

  console.log(`Rotations with earnings: ${[...cohortActivatingFrameIdsWithEarnings]}. First cohort ${firstCohort}`);
  expect(cohortActivatingFrameIdsWithEarnings.size).toBeGreaterThan(0);

  const cohort1Bids = await bot.storage.bidsFile(firstCohort).get();
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

  const cohortActivatingFrameIds = new Set<number>();
  let microgonsMined = 0n;
  for (const frameId of cohortActivatingFrameIdsWithEarnings) {
    const earningsData = await bot.storage.earningsFile(frameId!).get();
    expect(earningsData).toBeDefined();
    expect(Object.keys(earningsData!.byCohortActivatingFrameId).length).toBeGreaterThanOrEqual(1);
    for (const [cohortActivatingFrameId, cohortData] of Object.entries(earningsData!.byCohortActivatingFrameId)) {
      cohortActivatingFrameIds.add(Number(cohortActivatingFrameId!));
      expect(Number(cohortActivatingFrameId)).toBeGreaterThan(0);
      expect(cohortData.microgonsMined).toBeGreaterThan(0);
      microgonsMined += cohortData.microgonsMined;
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
    cohortActivatingFrameIdsWithEarnings: [...cohortActivatingFrameIdsWithEarnings],
    cohortActivatingFrameIds: [...cohortActivatingFrameIds],
  });
  await bot.stop();

  // try to recover from blocks

  const path2 = fs.mkdtempSync('/tmp/bot2-');
  runOnTeardown(() => fs.promises.rm(path2, { recursive: true, force: true }));
  const botRestart = new Bot({
    pair: sudo(),
    archiveRpcUrl: chain.address,
    localRpcUrl: chain.address,
    biddingRulesPath: Path.resolve(botDataDir, 'rules.json'),
    datadir: path2,
    keysMnemonic: mnemonicGenerate(),
    oldestFrameIdToSync: Math.min(...cohortActivatingFrameIds) - 1,
    shouldSkipDockerSync: true,
  });
  console.log('Starting bot 2');
  await expect(botRestart.start()).resolves.toBeUndefined();
  console.log('Stopping bot 2');
  await botRestart.stop();

  // compare directories
  for (const cohortActivatingFrameId of cohortActivatingFrameIdsWithEarnings) {
    const earningsFile1 = await bot.storage.earningsFile(cohortActivatingFrameId).get();
    const earningsFile2 = await botRestart.storage.earningsFile(cohortActivatingFrameId).get();
    console.info('Checking earnings for rotation', cohortActivatingFrameId);
    expect(earningsFile1).toBeTruthy();
    expect(earningsFile2).toBeTruthy();
    expect(earningsFile1!).toEqual(earningsFile2!);
  }

  for (const cohortActivatingFrameId of cohortActivatingFrameIds) {
    const bidsFile1 = await bot.storage.bidsFile(cohortActivatingFrameId).get();
    const bidsFile2 = await botRestart.storage.bidsFile(cohortActivatingFrameId).get();
    console.info('Checking bidding for cohort', cohortActivatingFrameId);
    expect(bidsFile1).toBeTruthy();
    expect(bidsFile2).toBeTruthy();
    expect(bidsFile1!).toEqual(bidsFile2!);
  }
}, 180e3);
