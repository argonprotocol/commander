import { type ArgonClient } from '@argonprotocol/mainchain';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);

export const TICKS_PER_COHORT = 14_400;

// These constants can be fetched from client.query.miningSlot.miningConfig()
const TICKS_PER_FRAME = 1_440;
const SLOT_BIDDING_START_AFTER_TICKS = 17_280;

// This constant can be fetched from client.query.ticks.genesisTick()
const GENESIS_TICK = 28_937_955;

/**
 * A frame is the period from noon EDT to the next noon EDT that a cohort of
 * miners rotates. The first frame (frame 0) was the period between bidding start and Frame 1 beginning.
 */
export class MiningFrames {
  private static miningConfig: { ticksBetweenSlots: number; slotBiddingStartAfterTicks: number } | undefined;
  private static genesisTick: number | undefined;

  public static async getTickRangeForFrame(client: ArgonClient, frameId: number): Promise<[number, number]> {
    this.miningConfig ??= await client.query.miningSlot.miningConfig().then(x => ({
      ticksBetweenSlots: x.ticksBetweenSlots.toNumber(),
      slotBiddingStartAfterTicks: x.slotBiddingStartAfterTicks.toNumber(),
    }));
    this.genesisTick ??= await client.query.ticks.genesisTick().then((x: { toNumber: () => number }) => x.toNumber());

    const ticksBetweenFrames = this.miningConfig!.ticksBetweenSlots;
    const frameZeroStart = this.genesisTick! + this.miningConfig!.slotBiddingStartAfterTicks;
    const startingTick = frameZeroStart + Math.floor(frameId * ticksBetweenFrames);
    const endingTick = startingTick + ticksBetweenFrames - 1;

    return [startingTick, endingTick];
  }

  public static calculateCurrentTickFromSystemTime(): number {
    return Math.floor(dayjs().utc().unix() / 60);
  }

  public static calculateCurrentFrameIdFromSystemTime(): number {
    const currentTick = this.calculateCurrentTickFromSystemTime();
    const slotOneStartTick = GENESIS_TICK + SLOT_BIDDING_START_AFTER_TICKS + TICKS_PER_FRAME;
    const ticksSinceSlotOne = currentTick - slotOneStartTick;
    return Math.floor(ticksSinceSlotOne / TICKS_PER_FRAME) + 1;
  }

  /**
   * Gets the tick range for a frameId using system time instead of blockchain client.
   * This method uses the hardcoded constants and current system time to calculate the range.
   *
   * @param frameId - The frame ID to get the tick range for
   * @returns A tuple containing [startingTick, endingTick] for the specified frame
   */
  public static getTickRangeForFrameFromSystemTime(frameId: number): [number, number] {
    const frameZeroStart = GENESIS_TICK + SLOT_BIDDING_START_AFTER_TICKS;
    const startingTick = frameZeroStart + Math.floor(frameId * TICKS_PER_FRAME);
    const endingTick = startingTick + TICKS_PER_FRAME - 1;

    return [startingTick, endingTick];
  }
}
