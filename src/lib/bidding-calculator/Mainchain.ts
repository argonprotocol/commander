import { getClient, type ArgonClient } from '@argonprotocol/mainchain';
import { convertFixedU128ToBigNumber, formatArgonots } from './Utils';

export type MainchainClient = ArgonClient;

const BLOCK_REWARD_INCREASE_PER_INTERVAL = 0.001;
const BLOCK_REWARD_MAX = 5;
const BLOCK_REWARD_INTERVAL = 118;

class Mainchain {
  // public client = getClient('wss://rpc.argon.network');
  public client: Promise<MainchainClient> = getClient('wss://rpc.testnet.argonprotocol.org');

  public async getOwnershipAmountMinimum(): Promise<number> {
    const client = await this.client;
    const value = await client.query.miningSlot.argonotsPerMiningSeat().then(x => x.toBigInt());
    return formatArgonots(value);
  }

  public async getTicksSinceGenesis(): Promise<number> {
    const client = await this.client;
    const genesisTick = (await client.query.ticks.genesisTick()).toNumber();
    const currentTick = (await client.query.ticks.currentTick()).toNumber();
    return currentTick - genesisTick;
  }

  public async currentMinimumRewardsPerBlock(): Promise<number> {
    const blocksSinceGenesis = await this.getTicksSinceGenesis();
    const initialReward = 0.5; // Initial Argon reward per block

    // Calculate the number of intervals
    const numIntervals = Math.floor(blocksSinceGenesis / BLOCK_REWARD_INTERVAL);

    // Calculate the current reward per block
    const currentReward = initialReward + (numIntervals * BLOCK_REWARD_INCREASE_PER_INTERVAL);
    return Math.min(currentReward, BLOCK_REWARD_MAX);
  }

  public async argonotBlockRewardsForThisSlot(): Promise<number> {
    const rewardsPerBlock = await this.currentMinimumRewardsPerBlock();
    const blocksPerSlot = 1_440;
    return rewardsPerBlock * blocksPerSlot;
  }

  public async argonBlockRewardsForFullYear(currentRewardsPerBlock: number): Promise<number> {
    const intervalsPerYear = (365 * 1440) / BLOCK_REWARD_INTERVAL;
    const startingRewardsPerBlock = await this.currentMinimumRewardsPerBlock();

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

  public async argonBlockRewardsForThisSlot(currentRewardsPerBlock: number): Promise<number> {
    const blocksPerSlot = 1_440;
    return currentRewardsPerBlock * blocksPerSlot;
  }

  public async getCurrentArgonTargetPrice(): Promise<number> {
    const client = await this.client;
    const argonPrice = (await client.query.priceIndex.current()).toPrimitive() as any;
    const argonUsdTargetPrice = argonPrice.argonUsdTargetPrice / 1_000_000_000_000_000_000;
    return argonUsdTargetPrice;
  }

  public async getMiningSeatCount(): Promise<number> {
    const client = await this.client;
    const activeMiners = (await client.query.miningSlot.activeMinersCount()).toNumber();
    return Math.max(activeMiners, 100);
  }

  public async getAggregateBidCosts(): Promise<number> {
    const client = await this.client;
    const activeMiners = await client.query.miningSlot.activeMinersByIndex.entries()
    
    let aggregateBidCosts = 0;
    if (!activeMiners.length) {
      return aggregateBidCosts;
    }

    for (const miner of activeMiners) {
      const data = miner[1].unwrap();
      const argons = data.bid.toNumber() / 1_000_000;
      const argonot = data.argonots.toNumber() / 1_000_000;
      const bidCost = argons + argonot;
      aggregateBidCosts += bidCost;
    }
    
    return aggregateBidCosts;
  }

  public async fetchArgonsInCirculationMinusBitcoinLocked() {
    const client = await this.client;

    const argonsInCirculation = (await client.query.balances.totalIssuance()).toNumber();
    const bitcoinArgons = (await client.query.mint.mintedBitcoinArgons()).toNumber();

    return (argonsInCirculation - bitcoinArgons) / 1_000_000;
  }

  public async fetchCurrentRewardsPerBlock() {
    const client = await this.client;
    return (await client.query.blockRewards.argonsPerBlock()).toNumber() / 1_000_000;
  }

  public async fetchExchangeRates() {
    const client = await this.client;
    
    
    const priceIndex = (await client.query.priceIndex.current()).value;
    const USD = convertFixedU128ToBigNumber(priceIndex.argonUsdTargetPrice.toBigInt()).toNumber();  
    const ARGNOT = convertFixedU128ToBigNumber(priceIndex.argonotUsdPrice.toBigInt()).toNumber() / USD;

    return { USD, ARGNOT };
  }

  public async getTickAtStartOfAuctionClosing(): Promise<bigint> {
    const client = await this.client;
    
    const nextSlotRangeBytes = await client.rpc.state.call('MiningSlotApi_next_slot_era', '');
    const nextSlotRangeRaw = client.createType('(u64, u64)', nextSlotRangeBytes);
    const nextSlotRange = [nextSlotRangeRaw[0].toBigInt(), nextSlotRangeRaw[1].toBigInt()];
    const tickAtStartOfNextCohort = nextSlotRange[0];    
    const ticksBeforeBidEndForVrfClose = (await client.query.miningSlot.miningConfig()).ticksBeforeBidEndForVrfClose.toBigInt();
    return tickAtStartOfNextCohort - ticksBeforeBidEndForVrfClose;
  }
}

const mainchain = new Mainchain();

export default mainchain;