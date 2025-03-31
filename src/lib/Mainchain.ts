import { getClient, type ArgonClient } from '@argonprotocol/mainchain';
import { formatArgonots } from './Utils';

export type MainchainClient = ArgonClient;

class Mainchain {
  public client = getClient('wss://rpc.argon.network');

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

  public async currentArgonRewardsPerBlock(): Promise<number> {
    const blocksSinceGenesis = await this.getTicksSinceGenesis();
    const initialReward = 0.5; // Initial Argon reward per block
    const increasePerInterval = 0.001; // Increase in reward per interval
    const intervalBlocks = 118; // Number of blocks per interval

    // Calculate the number of intervals
    const numIntervals = Math.floor(blocksSinceGenesis / intervalBlocks);

    // Calculate the current reward per block
    return initialReward + (numIntervals * increasePerInterval);
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
    for (const miner of activeMiners) {
      const data = miner[1].unwrap();
      const argons = data.bondedArgons.toNumber() / 1_000_000;
      const argonot = data.argonots.toNumber() / 1_000_000;
      const bidCost = argons + argonot;
      aggregateBidCosts += bidCost;
    }
    
    return aggregateBidCosts;
  }
}

const mainchain = new Mainchain();

export default mainchain;