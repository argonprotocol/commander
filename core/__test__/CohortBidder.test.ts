import { Accountset, CohortBidder, MiningBids, parseSubaccountRange } from '../src/index.js';
import { startArgonTestNetwork } from './startArgonTestNetwork.js';
import { describeIntegration, sudo, teardown } from '@argonprotocol/testing';
import { Keyring } from '@polkadot/api';
import { mnemonicGenerate } from '@polkadot/util-crypto';
import { afterAll, afterEach, expect, it } from 'vitest';
import { inspect } from 'util';
import { getClient } from '@argonprotocol/mainchain';

// set the default log depth to 10
inspect.defaultOptions.depth = 10;
afterEach(teardown);
afterAll(teardown);

describeIntegration('Cohort Bidder tests', () => {
  it('can compete on bids', async () => {
    const network = await startArgonTestNetwork('cohort-bidder', { profiles: ['bob'] });

    const aliceClientPromise = getClient(network.archiveUrl);
    const aliceClient = await aliceClientPromise;
    const bobRing = new Keyring({ type: 'sr25519' }).addFromUri('//Bob');

    const alice = new Accountset({
      client: aliceClient,
      seedAccount: sudo(),
      subaccountRange: parseSubaccountRange('0-49'),
      sessionMiniSecretOrMnemonic: mnemonicGenerate(),
      name: 'alice',
    });
    await alice.registerKeys(network.archiveUrl);
    console.log('Alice set up');
    // wait for bob to have ownership tokens
    await new Promise(async resolve => {
      const unsub = await alice.client.query.ownership.account(bobRing.address, x => {
        if (x.free.toBigInt() > 100_000n) {
          resolve(true);
          unsub();
        } else {
          console.log(`Waiting for bob to have ownership tokens`);
        }
      });
    });
    console.log('Bob has ownership tokens');

    const bobPort = await network.getPort('miner-1', 9944);
    const bobAddress = `ws://localhost:${bobPort}`;

    const bob = new Accountset({
      client: await getClient(bobAddress),
      seedAccount: bobRing,
      subaccountRange: parseSubaccountRange('0-49'),
      sessionMiniSecretOrMnemonic: mnemonicGenerate(),
      name: 'bob',
    });
    console.log('registering bob keys on', bobAddress);
    await bob.registerKeys(bobAddress);

    console.log('Alice and Bob set up');

    const miningBids = new MiningBids(alice.client);
    let bobBidder: CohortBidder;
    let aliceBidder: CohortBidder;
    // wait for the cohort to change so we have enough time
    const startingCohort = await aliceClient.query.miningSlot.nextFrameId();
    await new Promise(resolve => {
      const unsub = aliceClient.query.miningSlot.nextFrameId(x => {
        if (x.toNumber() > startingCohort.toNumber()) {
          resolve(true);
          unsub.then();
        }
      });
    });

    let waitForStopPromise: () => void;
    const waitForStop = new Promise<void>(resolve => {
      waitForStopPromise = resolve;
    });
    const { unsubscribe } = await miningBids.onCohortChange({
      async onBiddingStart(cohortStartingFrameId) {
        if (bobBidder) return;
        console.log(`Cohort ${cohortStartingFrameId} started bidding`);
        bobBidder = new CohortBidder(bob, cohortStartingFrameId, await bob.getAvailableMinerAccounts(10), {
          minBid: 10_000n,
          maxBid: 5_000_000n,
          maxBudget: 25_000_000n,
          bidIncrement: 1_000_000n,
          bidDelay: 0,
        });
        aliceBidder = new CohortBidder(alice, cohortStartingFrameId, await alice.getAvailableMinerAccounts(10), {
          minBid: 10_000n,
          maxBid: 4_000_000n,
          maxBudget: 40_000_000n,
          bidIncrement: 1_000_000n,
          bidDelay: 0,
        });
        await bobBidder.start();
        await aliceBidder.start();
      },
      async onBiddingEnd(cohortStartingFrameId) {
        console.log(`Cohort ${cohortStartingFrameId} ended bidding`);
        await aliceBidder.stop();
        await bobBidder.stop();
        waitForStopPromise();
      },
    });
    await waitForStop;
    unsubscribe();

    expect(aliceBidder!).toBeTruthy();
    expect(bobBidder!).toBeTruthy();

    const bobWatch = await bob.watchBlocks(true);
    const bobMinePromise = new Promise<{ argons: bigint }>(resolve => {
      bobWatch.events.on('mined', (_blockHash, mined) => {
        resolve(mined);
      });
    });
    const aliceWatch = await alice.watchBlocks(true);
    const aliceMinePromise = new Promise<{ argons: bigint }>(resolve => {
      aliceWatch.events.on('mined', (_blockHash, mined) => {
        resolve(mined);
      });
    });
    // wait for the slot to fully complete
    await new Promise(resolve =>
      aliceClient.query.miningSlot.nextFrameId(y => {
        if (y.toNumber() >= bobBidder!.cohortStartingFrameId) {
          resolve(true);
        }
      }),
    );

    const aliceMiners = await alice.miningSeats();
    const cohortStartingFrameId = aliceBidder!.cohortStartingFrameId;
    const bobMiners = await bob.miningSeats();

    const aliceStats = {
      seatsWon: aliceBidder!.winningBids.length,
      fees: aliceBidder!.txFees,
      bidsAttempted: aliceBidder!.bidsAttempted,
    };
    const bobStats = {
      seatsWon: bobBidder!.winningBids.length,
      fees: bobBidder!.txFees,
      bidsAttempted: bobBidder!.bidsAttempted,
    };
    console.log({ cohortStartingFrameId, aliceStats, bobStats });

    const bobActive = bobMiners.filter(x => x.seat !== undefined);
    const aliceActive = aliceMiners.filter(x => x.seat !== undefined);

    expect(bobActive.length).toBe(bobStats.seatsWon);
    expect(bobBidder!.bidsAttempted).toBeGreaterThanOrEqual(4);
    expect(bobStats.fees).toBeGreaterThanOrEqual(6_000n * 4n);

    expect(aliceActive.length).toBe(aliceStats.seatsWon);
    expect(aliceBidder!.bidsAttempted).toBeGreaterThanOrEqual(6);
    console.log('Waiting for each bidder to mine');
    if (bobStats.seatsWon > 0) {
      await expect(bobMinePromise).resolves.toBeTruthy();
    }
    if (aliceStats.seatsWon > 0) {
      await expect(aliceMinePromise).resolves.toBeTruthy();
    }
  }, 180e3);
});
