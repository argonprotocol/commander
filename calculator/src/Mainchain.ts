import BigNumber from 'bignumber.js';
import { type ArgonClient, convertFixedU128ToBigNumber, MICROGONS_PER_ARGON } from '@argonprotocol/mainchain';
import { bigIntMin, bigNumberToBigInt } from './utils.ts';
import { type IWinningBid } from '@argonprotocol/commander-bot';
import { MiningFrames } from './MiningFrames.ts';
import type { ApiDecoration, ApiTypes } from '@polkadot/api/types';

export type MainchainClient = ArgonClient;
export { MICROGONS_PER_ARGON };
export const BLOCK_REWARD_INCREASE_PER_INTERVAL = BigInt(1_000);
export const BLOCK_REWARD_MAX = BigInt(5_000_000);
export const BLOCK_REWARD_INTERVAL = 118;

export class Mainchain {
  constructor(public clientPromise: Promise<MainchainClient>) {}

  public async getMinimumMicronotsForBid(): Promise<bigint> {
    const client = await this.clientPromise;
    return await client.query.miningSlot.argonotsPerMiningSeat().then(x => x.toBigInt());
  }

  public async getFrameStartBlockNumbers(api: ApiDecoration<'promise'>): Promise<number[]> {
    const frameStartBlockNumbers = await api.query.miningSlot.frameStartBlockNumbers();
    return frameStartBlockNumbers.map(x => x.toNumber());
  }

  public async getLiquidityPoolPayout(): Promise<{ totalPoolRewards: bigint; totalActivatedCapital: bigint }> {
    const client = await this.clientPromise;
    const frameStartBlockNumbers = await this.getFrameStartBlockNumbers(client);
    const blockNumber = frameStartBlockNumbers[0];
    const blockHash = await client.rpc.chain.getBlockHash(blockNumber);
    const clientAt = await client.at(blockHash);
    const events = await clientAt.query.system.events();

    let totalMicrogonsBid = 0n;
    let totalActivatedCapital = 0n;
    for (const { event } of events) {
      if (client.events.miningSlot.NewMiners.is(event)) {
        for (const miner of event.data.newMiners) {
          totalMicrogonsBid += miner.bid.toBigInt();
        }
      }
      if (client.events.liquidityPools.NextBidPoolCapitalLocked.is(event)) {
        totalActivatedCapital = event.data.totalActivatedCapital.toBigInt();
      }
    }

    const totalPoolRewardsBn = BigNumber(totalMicrogonsBid).multipliedBy(0.8);
    const totalPoolRewards = bigNumberToBigInt(totalPoolRewardsBn);

    return {
      totalPoolRewards, //: 100_000 * MICROGONS_PER_ARGON,
      totalActivatedCapital, //: 998_000 * MICROGONS_PER_ARGON,
    };
  }

  public async getCurrentTick(): Promise<number> {
    const client = await this.clientPromise;
    return (await client.query.ticks.currentTick()).toNumber();
  }

  private async getTicksSinceGenesis(currentTick: number): Promise<number> {
    const client = await this.clientPromise;
    const genesisTick = (await client.query.ticks.genesisTick()).toNumber();
    return currentTick - genesisTick;
  }

  public async minimumBlockRewardsAtTick(currentTick: number): Promise<bigint> {
    const blocksSinceGenesis = await this.getTicksSinceGenesis(currentTick);
    const initialReward = 500_000n; // Initial microgons reward per block

    // Calculate the number of intervals
    const numIntervals = Math.floor(blocksSinceGenesis / BLOCK_REWARD_INTERVAL);

    // Calculate the current reward per block
    const currentReward = initialReward + BigInt(numIntervals) * BLOCK_REWARD_INCREASE_PER_INTERVAL;
    return bigIntMin(currentReward, BLOCK_REWARD_MAX);
  }

  public async getMinimumBlockRewardsDuringTickRange(tickStart: number, tickEnd: number): Promise<bigint> {
    // TODO: this is wrong, we need to increment the block rewards every 118 blocks
    const rewardsPerBlock = await this.minimumBlockRewardsAtTick(tickStart);
    const blocksToCalculate = tickEnd - tickStart;
    return rewardsPerBlock * BigInt(blocksToCalculate);
  }

  public async getCurrentArgonTargetPrice(): Promise<number> {
    const client = await this.clientPromise;
    const argonPrice = (await client.query.priceIndex.current()).unwrapOrDefault();
    return convertFixedU128ToBigNumber(argonPrice.argonUsdTargetPrice.toBigInt()).toNumber();
  }

  public async getMiningSeatCount(): Promise<number> {
    const client = await this.clientPromise;
    const activeMiners = (await client.query.miningSlot.activeMinersCount()).toNumber();
    return Math.max(activeMiners, 100);
  }

  public async getAggregateBidCosts(): Promise<bigint> {
    const client = await this.clientPromise;
    const bidsPerFrame = await client.query.miningSlot.minersByCohort.entries();

    let aggregateBidCosts = 0n;
    for (const [_, cohortData] of bidsPerFrame) {
      aggregateBidCosts += cohortData.reduce((acc, bid) => acc + bid.bid.toBigInt(), 0n);
    }

    return aggregateBidCosts;
  }

  public async getAggregateBlockRewards(): Promise<{
    microgons: bigint;
    micronots: bigint;
  }> {
    const client = await this.clientPromise;
    const blockRewards = await client.query.blockRewards.blockRewardsByCohort();
    const nextCohortId = blockRewards.pop()?.[0].toNumber() ?? 1;
    const currentCohortId = nextCohortId - 1;

    const currentTick = await this.getCurrentTick();
    const tickAtStartOfCurrentSlot = await this.getTickAtStartOfCurrentSlot();
    const ticksElapsedToday = currentTick - tickAtStartOfCurrentSlot;

    const rewards = { microgons: 0n, micronots: 0n };

    for (const [cohortId, blockReward] of blockRewards) {
      const fullRotationsSinceCohortStart = currentCohortId - cohortId.toNumber();
      const ticksSinceCohortStart = fullRotationsSinceCohortStart * 1_440 + ticksElapsedToday;
      const startingTick = currentTick - ticksSinceCohortStart;
      const endingTick = currentTick;
      const microgonsMinedInCohort = (blockReward.toBigInt() * BigInt(ticksSinceCohortStart)) / 10n;
      const micronotsMinedInCohort = (await this.getMinimumBlockRewardsDuringTickRange(startingTick, endingTick)) / 10n;
      rewards.microgons += microgonsMinedInCohort;
      rewards.micronots += micronotsMinedInCohort;
    }

    return rewards;
  }

  public async fetchMicrogonsInCirculation(): Promise<bigint> {
    const client = await this.clientPromise;
    return (await client.query.balances.totalIssuance()).toBigInt();
  }

  public async fetchMicrogonsMinedPerBlockDuringNextCohort(): Promise<bigint> {
    const client = await this.clientPromise;
    return await client.query.blockRewards.argonsPerBlock().then(x => x.toBigInt());
  }

  public async fetchMicrogonBlockFeesMined(blockHash?: Uint8Array | string): Promise<bigint> {
    const client = await this.clientPromise;
    const api = blockHash ? await client.at(blockHash) : client;
    const blockFees = await api.query.blockRewards.blockFees();
    return blockFees.toBigInt();
  }

  public async fetchMicrogonExchangeRatesTo(blockHash?: Uint8Array | string): Promise<{
    USD: bigint;
    ARGNOT: bigint;
    ARGN: bigint;
    BTC: bigint;
  }> {
    const client = await this.clientPromise;
    const api = blockHash ? await client.at(blockHash) : client;
    const microgonsForArgon = BigInt(1 * MICROGONS_PER_ARGON);
    const priceIndexRaw = await api.query.priceIndex.current();
    if (priceIndexRaw.isNone) {
      return {
        USD: microgonsForArgon,
        ARGNOT: microgonsForArgon,
        ARGN: microgonsForArgon,
        BTC: microgonsForArgon,
      };
    }

    const priceIndex = priceIndexRaw.value;
    const usdForArgon = convertFixedU128ToBigNumber(priceIndex.argonUsdPrice.toBigInt());
    const usdForArgnot = convertFixedU128ToBigNumber(priceIndex.argonotUsdPrice.toBigInt());
    const usdForBtc = convertFixedU128ToBigNumber(priceIndex.btcUsdPrice.toBigInt());

    // These exchange rates should be relative to the argon
    const microgonsForUsd = this.calculateExchangeRateInMicrogons(BigNumber(1), usdForArgon);
    const microgonsForArgnot = this.calculateExchangeRateInMicrogons(usdForArgnot, usdForArgon);
    const microgonsForBtc = this.calculateExchangeRateInMicrogons(usdForBtc, usdForArgon);

    return {
      ARGN: microgonsForArgon,
      USD: microgonsForUsd,
      ARGNOT: microgonsForArgnot,
      BTC: microgonsForBtc,
    };
  }

  public async getNextSlotRange(): Promise<[number, number]> {
    const client = await this.clientPromise;
    const nextSlotRangeBytes = await client.rpc.state.call('MiningSlotApi_next_slot_era', '');
    const nextSlotRangeRaw = client.createType('(u64, u64)', nextSlotRangeBytes);
    return [nextSlotRangeRaw[0].toNumber(), nextSlotRangeRaw[1].toNumber()];
  }

  public async getTickAtStartOfNextCohort(): Promise<number> {
    return (await this.getNextSlotRange())[0];
  }

  public async getTickAtStartOfAuctionClosing(): Promise<number> {
    const client = await this.clientPromise;
    const tickAtStartOfNextCohort = await this.getTickAtStartOfNextCohort();
    const ticksBeforeBidEndForVrfClose = (
      await client.query.miningSlot.miningConfig()
    ).ticksBeforeBidEndForVrfClose.toNumber();
    return tickAtStartOfNextCohort - ticksBeforeBidEndForVrfClose;
  }

  public async getTickAtStartOfCurrentSlot(): Promise<number> {
    const tickAtStartOfNextCohort = await this.getTickAtStartOfNextCohort();
    return tickAtStartOfNextCohort - 1_440;
  }

  public async fetchWinningBids(): Promise<IWinningBid[]> {
    const client = await this.clientPromise;
    const nextCohort = await client.query.miningSlot.bidsForNextSlotCohort();
    return nextCohort.map((c, i): IWinningBid => {
      const address = c.accountId.toHuman();
      const subAccountIndex = undefined;
      const lastBidAtTick = c.bidAtTick.toNumber();
      const bidPosition = i;
      const microgonsPerSeat = c.bid.toBigInt();
      return { address, subAccountIndex, lastBidAtTick, bidPosition, microgonsPerSeat };
    });
  }

  public async fetchWinningBidAmountsForFrame(frameId: number): Promise<bigint[]> {
    const client = await this.clientPromise;
    const winningBids = await client.query.miningSlot.minersByCohort(frameId);
    return winningBids.map(bid => bid.bid.toBigInt());
  }

  public async fetchPreviousDayWinningBidAmounts(): Promise<bigint[]> {
    const startingFrameId = MiningFrames.calculateCurrentFrameIdFromSystemTime();
    let frameIdToCheck = startingFrameId;
    while (true) {
      // We must loop backwards until we find a frame with winning bids
      frameIdToCheck--;
      if (frameIdToCheck < startingFrameId - 10) {
        // We've checked the last 10 frames and found no winning bids, so we're done
        return [];
      }
      const winningBids = await this.fetchWinningBidAmountsForFrame(frameIdToCheck);
      if (winningBids.length > 0) {
        return winningBids;
      }
    }
  }

  public async getCurrentFrameId(): Promise<number> {
    const client = await this.clientPromise;
    const nextFrameId = await client.query.miningSlot.nextFrameId();
    return nextFrameId.toNumber() - 1; // Subtract 1 to get the current frame ID
  }

  public async forEachFrame<T>(
    iterateByEpoch: boolean,
    callback: (
      justEndedFrameId: number,
      api: MainchainClient,
      meta: {
        blockNumber: number;
        specVersion: number;
      },
      abortController: AbortController,
    ) => Promise<T>,
  ): Promise<T[]> {
    const client = await this.clientPromise;
    const abortController = new AbortController();
    const seenFrames = new Set<number>();
    const results: T[] = [];

    let api = client as ApiDecoration<'promise'>;
    let apiSpecVersion = api.runtimeVersion.specVersion.toNumber();
    let frameStartBlockNumbers = await this.getFrameStartBlockNumbers(api);
    let startingFrameId = await api.query.miningSlot.nextFrameId().then(x => x.toNumber() - 1);

    for (let i = 0; i < frameStartBlockNumbers.length; i++) {
      const currentFrameId = startingFrameId - i;
      const blockNumber = frameStartBlockNumbers[i];
      const hasAlreadySeenThisFrame = seenFrames.has(currentFrameId);
      const shouldIterateThisFrame = iterateByEpoch && i === 0 && !hasAlreadySeenThisFrame;
      console.log(`Exploring frame ${currentFrameId}`);

      const iterateThisFrame = async () => {
        const result = await callback(
          currentFrameId,
          api as any,
          { blockNumber, specVersion: apiSpecVersion },
          abortController,
        );
        results.push(result);
      };

      if (shouldIterateThisFrame) {
        await iterateThisFrame();
        if (abortController.signal.aborted || currentFrameId <= 1) {
          break; // Stop processing if the abort signal is triggered
        }
      }
      seenFrames.add(currentFrameId);

      const isLastFrame = i === frameStartBlockNumbers.length - 1;

      if (isLastFrame) {
        const nextBlockHash = await client.rpc.chain.getBlockHash(blockNumber - 1);
        const nextApi = await client.at(nextBlockHash);
        const nextApiSpecVersion = nextApi.runtimeVersion.specVersion.toNumber();
        if (nextApiSpecVersion < 124) {
          // frameStartBlockNumbers is not available in versions < 124
          if (!shouldIterateThisFrame) {
            await iterateThisFrame();
          }
          break;
        }
        api = nextApi;
        apiSpecVersion = nextApiSpecVersion;
        frameStartBlockNumbers = await this.getFrameStartBlockNumbers(api);
        startingFrameId = currentFrameId - 1;
        console.log(`Reloaded frame start block numbers for next frame ${startingFrameId}`);
        i = -1;
      }
    }
    return results;
  }

  private calculateExchangeRateInMicrogons(usdAmount: BigNumber, usdForArgon: BigNumber): bigint {
    const oneArgonInMicrogons = BigInt(MICROGONS_PER_ARGON);
    const usdAmountBn = BigNumber(usdAmount);
    const usdForArgonBn = BigNumber(usdForArgon);
    if (usdAmountBn.isZero() || usdForArgonBn.isZero()) return oneArgonInMicrogons;

    const argonsRequired = usdAmountBn.dividedBy(usdForArgonBn);
    return bigNumberToBigInt(argonsRequired.multipliedBy(MICROGONS_PER_ARGON));
  }
}
