import { type ArgonClient, convertFixedU128ToBigNumber, MICROGONS_PER_ARGON } from '@argonprotocol/mainchain';
import BigNumber from 'bignumber.js';
import { bigIntMin, calculateCurrentFrameIdFromSystemTime } from './utils.ts';
import { type IWinningBid } from '@argonprotocol/commander-bot/src/storage.ts';

export type MainchainClient = ArgonClient;
export { MICROGONS_PER_ARGON };
export const BLOCK_REWARD_INCREASE_PER_INTERVAL = BigInt(1_000);
export const BLOCK_REWARD_MAX = BigInt(5_000_000);
export const BLOCK_REWARD_INTERVAL = BigInt(118);

export class Mainchain {
  constructor(public client: Promise<MainchainClient>) {}

  public async getMinimumMicronotsForBid(): Promise<bigint> {
    const client = await this.client;
    return await client.query.miningSlot.argonotsPerMiningSeat().then(x => x.toBigInt());
  }

  public async getFrameStartBlockNumbers(): Promise<number[]> {
    const client = await this.client;
    const frameStartBlockNumbers = await client.query.miningSlot.frameStartBlockNumbers();
    return frameStartBlockNumbers.map(x => x.toNumber());
  }

  public async getLiquidityPoolPayout(): Promise<{ totalPoolRewards: bigint; totalActivatedCapital: bigint }> {
    const client = await this.client;
    const frameStartBlockNumbers = await this.getFrameStartBlockNumbers();
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
    const totalPoolRewards = BigInt(totalPoolRewardsBn.integerValue().toString());

    return {
      totalPoolRewards, //: 100_000 * MICROGONS_PER_ARGON,
      totalActivatedCapital, //: 998_000 * MICROGONS_PER_ARGON,
    };
  }

  public async getCurrentTick(): Promise<number> {
    const client = await this.client;
    return (await client.query.ticks.currentTick()).toNumber();
  }

  private async getTicksSinceGenesis(currentTick: bigint): Promise<bigint> {
    const client = await this.client;
    const genesisTick = (await client.query.ticks.genesisTick()).toBigInt();
    return currentTick - genesisTick;
  }

  public async minimumBlockRewardsAtTick(currentTick: bigint): Promise<bigint> {
    const blocksSinceGenesis = await this.getTicksSinceGenesis(currentTick);
    const initialReward = 500_000n; // Initial microgons reward per block

    // Calculate the number of intervals
    const numIntervals = blocksSinceGenesis / BLOCK_REWARD_INTERVAL;

    // Calculate the current reward per block
    const currentReward = initialReward + numIntervals * BLOCK_REWARD_INCREASE_PER_INTERVAL;
    return bigIntMin(currentReward, BLOCK_REWARD_MAX);
  }

  public async getMinimumBlockRewardsDuringTickRange(tickStart: bigint, tickEnd: bigint): Promise<bigint> {
    // TODO: this is wrong, we need to increment the block rewards every 118 blocks
    const rewardsPerBlock = await this.minimumBlockRewardsAtTick(tickStart);
    const blocksToCalculate = tickEnd - tickStart;
    return rewardsPerBlock * blocksToCalculate;
  }

  public async getCurrentArgonTargetPrice(): Promise<number> {
    const client = await this.client;
    const argonPrice = (await client.query.priceIndex.current()).unwrapOrDefault();
    return convertFixedU128ToBigNumber(argonPrice.argonUsdTargetPrice.toBigInt()).toNumber();
  }

  public async getMiningSeatCount(): Promise<number> {
    const client = await this.client;
    const activeMiners = (await client.query.miningSlot.activeMinersCount()).toNumber();
    return Math.max(activeMiners, 100);
  }

  public async getAggregateBidCosts(): Promise<bigint> {
    const client = await this.client;
    const bidsPerFrame = await client.query.miningSlot.historicalBidsPerSlot();

    let aggregateBidCosts = 0n;
    for (const bids of bidsPerFrame) {
      aggregateBidCosts += bids.bidAmountSum.toBigInt();
    }

    return aggregateBidCosts;
  }

  public async getAggregateBlockRewards(): Promise<{
    microgons: bigint;
    micronots: bigint;
  }> {
    const client = await this.client;
    const blockRewards = await client.query.blockRewards.blockRewardsByCohort();
    const nextCohortId = blockRewards.pop()?.[0].toBigInt() ?? 1n;
    const currentCohortId = nextCohortId - 1n;

    const currentTick = BigInt(await this.getCurrentTick());
    const tickAtStartOfCurrentSlot = await this.getTickAtStartOfCurrentSlot();
    const ticksElapsedToday = currentTick - tickAtStartOfCurrentSlot;

    const rewards = { microgons: 0n, micronots: 0n };

    for (const [cohortId, blockReward] of blockRewards) {
      const fullRotationsSinceCohortStart = currentCohortId - cohortId.toBigInt();
      const ticksSinceCohortStart = fullRotationsSinceCohortStart * 1_440n + ticksElapsedToday;
      // const startingTick = currentTick - ticksSinceCohortStart;
      // const endingTick = currentTick;
      const microgonsMinedInCohort = (blockReward.toBigInt() * ticksSinceCohortStart) / 10n;
      const micronotsMinedInCohort = 0n; // TODO: this.getMicronotsMinedForRange(startingTick, endingTick);
      rewards.microgons += microgonsMinedInCohort;
      rewards.micronots += micronotsMinedInCohort;
    }

    return rewards;
  }

  public async fetchMicrogonsInCirculation(): Promise<bigint> {
    const client = await this.client;
    return (await client.query.balances.totalIssuance()).toBigInt();
  }

  private async fetchMicrogonsInCirculationMinusBitcoinLocked(): Promise<bigint> {
    const client = await this.client;

    const argonsInCirculation = await this.fetchMicrogonsInCirculation();
    const bitcoinArgons = (await client.query.mint.mintedBitcoinArgons()).toBigInt();

    return argonsInCirculation - bitcoinArgons;
  }

  public async fetchMicrogonsMinedPerBlockDuringNextCohort(): Promise<bigint> {
    const client = await this.client;
    return await client.query.blockRewards.argonsPerBlock().then(x => x.toBigInt());
  }

  public async fetchMicrogonExchangeRatesTo(): Promise<{
    USD: bigint;
    ARGNOT: bigint;
    ARGN: bigint;
    BTC: bigint;
  }> {
    const client = await this.client;
    const microgonsForArgon = BigInt(1 * MICROGONS_PER_ARGON);
    const priceIndexRaw = await client.query.priceIndex.current();
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
    const microgonsForUsd = this.calculateExchangeRateInMicrogons(BigNumber(microgonsForArgon), usdForArgon);
    const microgonsForArgnot = this.calculateExchangeRateInMicrogons(usdForArgnot, usdForArgon);
    const microgonsForBtc = this.calculateExchangeRateInMicrogons(usdForBtc, usdForArgon);

    return {
      ARGN: microgonsForArgon,
      USD: microgonsForUsd,
      ARGNOT: microgonsForArgnot,
      BTC: microgonsForBtc,
    };
  }

  public async getNextSlotRange(): Promise<[bigint, bigint]> {
    const client = await this.client;
    const nextSlotRangeBytes = await client.rpc.state.call('MiningSlotApi_next_slot_era', '');
    const nextSlotRangeRaw = client.createType('(u64, u64)', nextSlotRangeBytes);
    return [nextSlotRangeRaw[0].toBigInt(), nextSlotRangeRaw[1].toBigInt()];
  }

  public async getTickAtStartOfNextCohort(): Promise<bigint> {
    return (await this.getNextSlotRange())[0];
  }

  public async getTickAtStartOfAuctionClosing(): Promise<bigint> {
    const client = await this.client;
    const tickAtStartOfNextCohort = await this.getTickAtStartOfNextCohort();
    const ticksBeforeBidEndForVrfClose = (
      await client.query.miningSlot.miningConfig()
    ).ticksBeforeBidEndForVrfClose.toBigInt();
    return tickAtStartOfNextCohort - ticksBeforeBidEndForVrfClose;
  }

  public async getTickAtStartOfCurrentSlot(): Promise<bigint> {
    const tickAtStartOfNextCohort = await this.getTickAtStartOfNextCohort();
    return tickAtStartOfNextCohort - 1_440n;
  }

  public async fetchVaults() {
    const client = await this.client;
    const vaultEntries = await client.query.vaults.vaultsById.entries();

    const vaults: IVault[] = [];
    for (const [idxRaw, vaultRaw] of vaultEntries) {
      const idx = idxRaw.args[0].toNumber();
      const vaultData = vaultRaw.unwrap();
      const satoshiLocked = 15_000_000; //vaultData.bitcoinLocked.toNumber()
      vaults.push({
        idx,
        bitcoinLocked: satoshiLocked / 100_000_000,
      });
    }

    return vaults;
  }

  public async fetchWinningBids(): Promise<IWinningBid[]> {
    const client = await this.client;
    const nextCohort = await client.query.miningSlot.bidsForNextSlotCohort();
    return nextCohort.map((c, i): IWinningBid => {
      const address = c.accountId.toHuman();
      const subAccountIndex = undefined;
      const lastBidAtTick = c.bidAtTick.toNumber();
      const bidPosition = i;
      const microgonsBid = c.bid.toBigInt();
      return { address, subAccountIndex, lastBidAtTick, bidPosition, microgonsBid };
    });
  }

  public async fetchWinningBidAmountsForFrame(frameId: number): Promise<bigint[]> {
    const client = await this.client;
    const winningBids = await client.query.miningSlot.minersByCohort(frameId);
    return winningBids.map(bid => bid.bid.toBigInt());
  }

  public async fetchPreviousDayWinningBidAmounts(): Promise<bigint[]> {
    const startingFrameId = calculateCurrentFrameIdFromSystemTime();
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

  private calculateExchangeRateInMicrogons(usdAmount: BigNumber, usdForArgon: BigNumber): bigint {
    const defaultValue = BigInt(1 * MICROGONS_PER_ARGON);
    if (usdAmount.isZero() || usdForArgon.isZero()) return defaultValue;

    const argons = usdAmount.dividedBy(usdForArgon);
    return BigInt(argons.multipliedBy(MICROGONS_PER_ARGON).integerValue().toString());
  }
}

export interface IVault {
  idx: number;
  bitcoinLocked: number;
}
