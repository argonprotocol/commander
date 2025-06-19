import { type ArgonClient, convertFixedU128ToBigNumber, MICROGONS_PER_ARGON } from '@argonprotocol/mainchain';
import { formatArgonots } from './utils.js';

export type MainchainClient = ArgonClient;

const BLOCK_REWARD_INCREASE_PER_INTERVAL = 0.001;
const BLOCK_REWARD_MAX = 5;
const BLOCK_REWARD_INTERVAL = 118;

export class Mainchain {
  constructor(public client: Promise<MainchainClient>) {}

  public async getOwnershipAmountMinimum(): Promise<number> {
    const client = await this.client;
    const value = await client.query.miningSlot.argonotsPerMiningSeat().then(x => x.toBigInt());
    return formatArgonots(value);
  }

  public async getCurrentTick(): Promise<bigint> {
    const client = await this.client;
    return (await client.query.ticks.currentTick()).toBigInt();
  }

  public async getTicksSinceGenesis(currentTick: bigint): Promise<number> {
    const client = await this.client;
    const genesisTick = (await client.query.ticks.genesisTick()).toNumber();
    return Number(currentTick) - genesisTick;
  }

  public async currentMinimumRewardsAtTick(currentTick: bigint): Promise<number> {
    const blocksSinceGenesis = await this.getTicksSinceGenesis(currentTick);
    const initialReward = 0.5; // Initial Argon reward per block

    // Calculate the number of intervals
    const numIntervals = Math.floor(blocksSinceGenesis / BLOCK_REWARD_INTERVAL);

    // Calculate the current reward per block
    const currentReward = initialReward + numIntervals * BLOCK_REWARD_INCREASE_PER_INTERVAL;
    return Math.min(currentReward, BLOCK_REWARD_MAX);
  }

  public async argonotBlockRewardsForThisSlot(): Promise<number> {
    const currentTick = await this.getCurrentTick();
    const rewardsPerBlock = await this.currentMinimumRewardsAtTick(currentTick);
    const blocksPerSlot = 1_440;
    return rewardsPerBlock * blocksPerSlot;
  }

  public async argonBlockRewardsForFullYear(currentRewardsPerBlock: number): Promise<number> {
    const intervalsPerYear = (365 * 1440) / BLOCK_REWARD_INTERVAL;
    const currentTick = await this.getCurrentTick();
    const startingRewardsPerBlock = await this.currentMinimumRewardsAtTick(currentTick);

    let totalRewards = 0;
    let minimumRewardsPerBlock = startingRewardsPerBlock;
    for (let i = 0; i < intervalsPerYear; i++) {
      minimumRewardsPerBlock += BLOCK_REWARD_INCREASE_PER_INTERVAL;
      minimumRewardsPerBlock = Math.min(minimumRewardsPerBlock, BLOCK_REWARD_MAX);
      currentRewardsPerBlock = Math.max(minimumRewardsPerBlock, currentRewardsPerBlock);
      totalRewards += currentRewardsPerBlock * BLOCK_REWARD_INTERVAL;
    }

    const intervalsPerYearRemainder = intervalsPerYear % 1;
    if (intervalsPerYearRemainder > 0) {
      totalRewards += currentRewardsPerBlock * (BLOCK_REWARD_INTERVAL * intervalsPerYearRemainder);
    }

    return totalRewards;
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

  public async getAggregateBidCosts(): Promise<number> {
    const client = await this.client;
    const bidsPerFrame = await client.query.miningSlot.historicalBidsPerSlot();

    let aggregateBidCosts = 0;
    for (const bids of bidsPerFrame) {
      aggregateBidCosts += bids.bidAmountSum.toNumber();
    }

    return aggregateBidCosts;
  }

  public async getAggregateBlockRewards(): Promise<{
    argons: number;
    argonots: number;
  }> {
    const client = await this.client;
    const blockRewards = await client.query.blockRewards.blockRewardsByCohort();
    const nextCohortId = blockRewards.pop()?.[0].toBigInt() ?? 1n;
    const currentCohortId = nextCohortId - 1n;

    const currentTick = await this.getCurrentTick();
    const tickAtStartOfCurrentSlot = await this.getTickAtStartOfCurrentSlot();
    const ticksElapsedToday = currentTick - tickAtStartOfCurrentSlot;

    const rewards = { argons: 0n, argonots: 0n };

    for (const [cohortId, blockReward] of blockRewards) {
      const fullRotationsSinceCohortStart = currentCohortId - cohortId.toBigInt();
      const ticksSinceCohortStart = fullRotationsSinceCohortStart * 1_440n + ticksElapsedToday;
      // const startingTick = currentTick - ticksSinceCohortStart;
      // const endingTick = currentTick;
      const argonsMinedInCohort = (blockReward.toBigInt() * ticksSinceCohortStart) / 10n;
      const argonotsMinedInCohort = 0n; // TODO: this.getArgonotsMinedForRange(startingTick, endingTick);
      rewards.argons += argonsMinedInCohort;
      rewards.argonots += argonotsMinedInCohort;
    }

    return {
      argons: Number(rewards.argons) / MICROGONS_PER_ARGON,
      argonots: Number(rewards.argonots) / MICROGONS_PER_ARGON,
    };
  }

  public async fetchArgonsInCirculationMinusBitcoinLocked() {
    const client = await this.client;

    const argonsInCirculation = (await client.query.balances.totalIssuance()).toNumber();
    const bitcoinArgons = (await client.query.mint.mintedBitcoinArgons()).toNumber();

    return (argonsInCirculation - bitcoinArgons) / MICROGONS_PER_ARGON;
  }

  public async fetchCurrentRewardsPerBlock() {
    const client = await this.client;
    return (await client.query.blockRewards.argonsPerBlock()).toNumber() / MICROGONS_PER_ARGON;
  }

  public async fetchExchangeRates(): Promise<{
    USD: number;
    ARGNOT: number;
    ARGN: number;
    BTC: number;
  }> {
    const client = await this.client;
    const priceIndex = (await client.query.priceIndex.current()).value;
    const USD = convertFixedU128ToBigNumber(priceIndex.argonUsdPrice.toBigInt()).toNumber();
    const ARGNOT = convertFixedU128ToBigNumber(priceIndex.argonotUsdPrice.toBigInt()).toNumber() / USD;
    const BTC = convertFixedU128ToBigNumber(priceIndex.btcUsdPrice.toBigInt()).toNumber() / USD;
    const ARGN = 1;

    return { USD, ARGNOT, ARGN, BTC };
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
}

export interface IVault {
  idx: number;
  bitcoinLocked: number;
}
