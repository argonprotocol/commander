import { FrameCalculator } from '@argonprotocol/mainchain';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { NetworkConfig } from './NetworkConfig.js';

dayjs.extend(utc);

export const TICKS_PER_COHORT = 14_400;

/**
 * A frame is the period from noon EDT to the next noon EDT that a cohort of
 * miners rotates. The first frame (frame 0) was the period between bidding start and Frame 1 beginning.
 */
export class MiningFrames {
  private static networkName: keyof typeof NetworkConfig | undefined = undefined;

  public static setNetwork(networkName: keyof typeof NetworkConfig) {
    if (!(networkName in NetworkConfig)) {
      throw new Error(`${networkName} is not a valid Network chain name`);
    }
    this.networkName = networkName as any;
  }

  public static getTickRangeForFrame(frameId: number): [number, number] {
    const config = this.getConfig();
    return FrameCalculator.calculateTickRangeForFrame(frameId, config);
  }

  public static calculateCurrentTickFromSystemTime(): number {
    const config = this.getConfig();
    return Math.floor(Date.now() / config.tickMillis);
  }

  public static calculateCurrentFrameIdFromSystemTime(): number {
    const config = this.getConfig();
    const currentTick = this.calculateCurrentTickFromSystemTime();
    const { ticksBetweenFrames, biddingStartTick } = config;
    const ticksSinceSlotOne = currentTick - biddingStartTick;
    return Math.floor(ticksSinceSlotOne / ticksBetweenFrames);
  }

  private static getConfig(): Awaited<ReturnType<FrameCalculator['load']>> {
    if (!this.networkName) {
      throw new Error(`Network name must be defined prior to loading configs`);
    }
    const config = NetworkConfig[this.networkName];
    if (!config) {
      throw new Error(`Network name ${this.networkName} is not a key of the app configs`);
    }

    return config;
  }
}
