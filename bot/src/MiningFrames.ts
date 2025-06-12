import { type ArgonClient } from '@argonprotocol/mainchain';

/**
 * A frame is the period from noon EDT to the next noon EDT that a cohort of
 * miners rotates. The first frame (frame 0) was the period between bidding start and Frame 1 beginning.
 */
export class MiningFrames {
  private miningConfig:
    | { ticksBetweenSlots: number; slotBiddingStartAfterTicks: number }
    | undefined;
  private genesisTick: number | undefined;

  async getTickRangeForFrame(client: ArgonClient, frameId: number): Promise<[number, number]> {
    this.miningConfig ??= await client.query.miningSlot.miningConfig().then(x => ({
      ticksBetweenSlots: x.ticksBetweenSlots.toNumber(),
      slotBiddingStartAfterTicks: x.slotBiddingStartAfterTicks.toNumber(),
    }));
    this.genesisTick ??= await client.query.ticks
      .genesisTick()
      .then((x: { toNumber: () => number }) => x.toNumber());

    const ticksBetweenFrames = this.miningConfig!.ticksBetweenSlots;
    const frameZeroStart = this.genesisTick! + this.miningConfig!.slotBiddingStartAfterTicks;
    const startingTick = frameZeroStart + Math.floor(frameId * ticksBetweenFrames);
    const endingTick = startingTick + ticksBetweenFrames - 1;

    return [startingTick, endingTick];
  }
}
