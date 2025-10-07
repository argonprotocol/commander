import type { MainchainClients } from './MainchainClients.js';
import { getTickFromHeader, type ArgonClient } from '@argonprotocol/mainchain';
import { type ApiDecoration } from '@polkadot/api/types';
import { MiningFrames } from './MiningFrames.js';
import type { BlockHash, Header as BlockHeader } from '@polkadot/types/interfaces';

export type { ApiDecoration };

export type ICallbackFirstBlockMeta = {
  specVersion: number;
  blockNumber: number;
  blockHash: BlockHash;
  blockTick: number;
};

export type ICallbackForFrame<T> = (
  frameId: number,
  firstBlockMeta: ICallbackFirstBlockMeta,
  api: ApiDecoration<'promise'>,
  abortController: AbortController,
) => Promise<T>;

export type ICallbackForFrameAll<T> = (
  frameId: number,
  firstBlockMeta: ICallbackFirstBlockMeta | null,
  api: ApiDecoration<'promise'> | null,
  abortController: AbortController,
) => Promise<T>;

export class FrameIterator {
  constructor(
    public readonly clients: MainchainClients,
    readonly iterateByEpoch: boolean = false,
    private name: string = 'FrameIterator',
  ) {}

  public async forEachFrame<T>(callback: ICallbackForFrame<T>): Promise<T[]> {
    const archiveClient = await this.clients.archiveClientPromise;
    const abortController = new AbortController();
    const seenFrames = new Set<number>();
    const results: T[] = [];

    let api = archiveClient as ApiDecoration<'promise'>;
    let specVersion = api.runtimeVersion.specVersion.toNumber();
    let frameStartBlockNumbers = await this.getFrameStartBlockNumbers(api);

    let blockNumber: number;
    let blockHash: BlockHash;
    let blockTick: number;

    for (let i = 0; i < frameStartBlockNumbers.length; i++) {
      blockNumber = frameStartBlockNumbers[i];
      blockHash = await archiveClient.rpc.chain.getBlockHash(blockNumber);
      const blockHeader = await archiveClient.rpc.chain.getHeader(blockHash);
      blockTick = getTickFromHeader(archiveClient, blockHeader)!;
      api = await archiveClient.at(blockHash);
      specVersion = api.runtimeVersion.specVersion.toNumber();
      if (specVersion < 124) break;

      const currentFrameId = await api.query.miningSlot.nextFrameId().then(x => x.toNumber() - 1);
      const isFirstBlockOfFrame = await this.isFirstBlockOfFrame(currentFrameId, blockNumber, archiveClient);
      if (!isFirstBlockOfFrame) break;

      const hasAlreadySeenThisFrame = seenFrames.has(currentFrameId);
      let shouldIterateThisFrame = !hasAlreadySeenThisFrame;
      if (this.iterateByEpoch) {
        shouldIterateThisFrame = i === 0 && !hasAlreadySeenThisFrame;
      }

      if (shouldIterateThisFrame) {
        console.log(`[${this.name}] Exploring frame ${currentFrameId} (blockNumber = ${blockNumber})`);
        const firstBlockMeta = { specVersion, blockNumber, blockHash, blockTick };
        const result = await callback(currentFrameId, firstBlockMeta, api as any, abortController);
        results.push(result);
        if (abortController.signal.aborted || currentFrameId <= 1) {
          break; // Stop processing if the abort signal is triggered
        }
      }

      seenFrames.add(currentFrameId);

      const isLastFrame = i === frameStartBlockNumbers.length - 1;
      if (isLastFrame) {
        frameStartBlockNumbers = await this.getFrameStartBlockNumbers(api);
        i = 0;
      }
    }

    return results;
  }

  public async forEachFrameAll<T>(callback: ICallbackForFrameAll<T>): Promise<T[]> {
    const seenFrameIds = new Set<number>();

    let currentBlockNumber = 0;
    let currentFrameId = 0;

    const results: T[] = await this.forEachFrame(
      async (
        frameId: number,
        firstBlockMeta: ICallbackFirstBlockMeta,
        api: ApiDecoration<'promise'>,
        abortController: AbortController,
      ) => {
        currentBlockNumber = firstBlockMeta?.blockNumber ?? 0;
        currentFrameId = frameId;
        seenFrameIds.add(frameId);
        return await callback(frameId, firstBlockMeta, api, abortController);
      },
    );

    const abortController = new AbortController();

    while (currentFrameId > 1) {
      const [frameId, firstBlockMeta, api] = await this.getStartOfFrame(currentFrameId - 1, currentBlockNumber - 1);
      if (firstBlockMeta) {
        currentBlockNumber = firstBlockMeta.blockNumber;
      }
      currentFrameId = frameId;
      console.log(`[${this.name}] Exploring frame ${currentFrameId} (blockNumber = ${currentBlockNumber}) --`);
      await callback(currentFrameId, firstBlockMeta, api, abortController);
    }

    return results;
  }

  private async getStartOfFrame(
    frameIdToFind: number,
    blockNumber: number,
  ): Promise<[number, ICallbackFirstBlockMeta | null, ApiDecoration<'promise'> | null]> {
    const archiveClient = await this.clients.archiveClientPromise;

    // First, get the meta of initial block
    let blockHash = await archiveClient.rpc.chain.getBlockHash(blockNumber);
    let blockHeader = await archiveClient.rpc.chain.getHeader(blockHash);
    let blockTick = getTickFromHeader(archiveClient, blockHeader)!;
    let frameId = MiningFrames.getForHeader(archiveClient, blockHeader);
    const [frameTickStart, _] = MiningFrames.getTickRangeForFrame(frameIdToFind);

    let isFirstJump = true;
    let isFirstBlockOfFrame = false;
    let earliestSearchData: { blockNumber: number; blockTick: number } | null = null;
    let latestSearchData: { blockNumber: number; blockTick: number } = { blockNumber, blockTick };

    while (!isFirstBlockOfFrame) {
      const jump = await this.nextClosestJump(
        isFirstJump,
        frameTickStart,
        { blockNumber, blockTick },
        earliestSearchData,
        latestSearchData,
        frameIdToFind,
      );
      isFirstJump = false;
      blockNumber = jump.blockNumber;
      blockHash = jump.blockHash;
      blockHeader = jump.header;
      blockTick = jump.blockTick;
      frameId = jump.frameId;
      earliestSearchData = jump.earliestSearchData;
      latestSearchData = jump.latestSearchData;

      if (frameId === frameIdToFind) {
        isFirstBlockOfFrame = await this.isFirstBlockOfFrame(frameIdToFind, blockNumber, archiveClient);
      }
      if (jump.hasExhaustedSearch && !isFirstBlockOfFrame) {
        console.log(`[${this.name}] Exhausted search for first block of frame '${frameIdToFind}'`);
        return [frameIdToFind, null, null];
      }
    }

    const api = await archiveClient.at(blockHash);
    const specVersion = api.runtimeVersion.specVersion.toNumber();
    const firstBlockMeta = { specVersion, blockNumber, blockHash, blockTick };

    return [frameIdToFind, firstBlockMeta, api];
  }

  public async getClosestToTick(
    tickToFind: number,
    blockNumber: number,
  ): Promise<[number, ICallbackFirstBlockMeta, ApiDecoration<'promise'>]> {
    const archiveClient = await this.clients.archiveClientPromise;

    // First, get the meta of initial block
    let blockHash = await archiveClient.rpc.chain.getBlockHash(blockNumber);
    let blockHeader = await archiveClient.rpc.chain.getHeader(blockHash);
    let blockTick = getTickFromHeader(archiveClient, blockHeader)!;
    let frameId = MiningFrames.getForHeader(archiveClient, blockHeader);

    let isFirstJump = true;
    let hasFoundOptimalBlock = false;
    let earliestSearchData: { blockNumber: number; blockTick: number } | null = null;
    let latestSearchData: { blockNumber: number; blockTick: number } = { blockNumber, blockTick };

    while (!hasFoundOptimalBlock) {
      const jump = await this.nextClosestJump(
        isFirstJump,
        tickToFind,
        { blockNumber, blockTick },
        earliestSearchData,
        latestSearchData,
      );
      isFirstJump = false;
      blockNumber = jump.blockNumber;
      blockHash = jump.blockHash;
      blockHeader = jump.header;
      blockTick = jump.blockTick;
      frameId = jump.frameId;
      earliestSearchData = jump.earliestSearchData;
      latestSearchData = jump.latestSearchData;
      hasFoundOptimalBlock = jump.hasExhaustedSearch;
    }

    const api = await archiveClient.at(blockHash);
    const specVersion = api.runtimeVersion.specVersion.toNumber();
    const firstBlockMeta = { specVersion, blockNumber, blockHash, blockTick };

    return [frameId!, firstBlockMeta, api];
  }

  private async nextClosestJump(
    isFirstJump: boolean,
    frameTickStart: number,
    currentBlockData: { blockNumber: number; blockTick: number },
    earliestSearchData: { blockNumber: number; blockTick: number } | null,
    latestSearchData: { blockNumber: number; blockTick: number },
    frameIdToFind?: number,
  ): Promise<{
    blockNumber: number;
    blockTick: number;
    frameId: number;
    blockHash: BlockHash;
    header: BlockHeader;
    earliestSearchData: { blockNumber: number; blockTick: number } | null;
    latestSearchData: { blockNumber: number; blockTick: number };
    hasExhaustedSearch: boolean;
  }> {
    const client = await this.clients.archiveClientPromise;

    let blockNumber: number;
    let jumpBy: number;

    if (isFirstJump) {
      // First jump: use tick-based estimation
      const ticksDiff = frameTickStart - currentBlockData.blockTick;
      const ticksPerFrame = 1_400; // if first jump, we'll jump by a whole frame
      if (ticksDiff > 0) {
        jumpBy = Math.min(ticksPerFrame, ticksDiff);
      } else if (ticksDiff < 0) {
        jumpBy = Math.max(-ticksPerFrame, ticksDiff);
      } else {
        jumpBy = 0;
      }
      blockNumber = Math.max(0, currentBlockData.blockNumber + jumpBy);
    } else {
      // Subsequent jumps: use binary search between bounds, but respect tick constraints
      const lowerBound = Math.max(0, earliestSearchData ? earliestSearchData.blockNumber + 1 : 0);
      const upperBound = latestSearchData.blockNumber - 1;

      if (lowerBound >= upperBound) {
        // We've narrowed it down to a single block
        blockNumber = lowerBound;
      } else {
        // Binary search: jump to the middle of the remaining range
        const targetBlockNumber = Math.floor((lowerBound + upperBound) / 2);
        const maxJumpBy = Math.max(1, Math.abs(frameTickStart - currentBlockData.blockTick));

        // Respect the tick difference constraint
        if (frameTickStart > currentBlockData.blockTick) {
          // Moving forward: don't jump more than the tick difference
          blockNumber = Math.min(targetBlockNumber, currentBlockData.blockNumber + maxJumpBy);
        } else {
          // Moving backward: don't jump more than the tick difference
          blockNumber = Math.max(targetBlockNumber, currentBlockData.blockNumber - maxJumpBy);
        }
      }
      jumpBy = blockNumber - currentBlockData.blockNumber;
      if (!earliestSearchData) {
        const ticksPerHour = 60; // if we don't have an earlier bound, jump by an hour
        jumpBy = Math.max(-ticksPerHour, jumpBy);
      }
    }

    const blockHash = await client.rpc.chain.getBlockHash(blockNumber);
    const header = await client.rpc.chain.getHeader(blockHash);
    const frameId = MiningFrames.getForHeader(client, header);
    const blockTick = blockNumber === 0 ? await this.getGenesisTick(client) : getTickFromHeader(client, header)!;

    // Update search bounds based on the result. We want to use frameId if it exists.
    const isLessThanTarget = frameIdToFind ? frameId! < frameIdToFind : blockTick < frameTickStart;
    if (isLessThanTarget) {
      // We're before the target, update lower bound
      earliestSearchData = { blockNumber, blockTick };
    } else {
      // We're at or past the target, update upper bound
      latestSearchData = { blockNumber, blockTick };
    }

    return {
      blockNumber,
      blockTick,
      frameId: frameId!,
      blockHash,
      header,
      earliestSearchData,
      latestSearchData,
      hasExhaustedSearch: blockNumber === 0 || jumpBy === 0,
    };
  }

  private async isFirstBlockOfFrame(blockFrameId: number, blockNumber: number, client: ArgonClient): Promise<boolean> {
    const previousBlockHash = await client.rpc.chain.getBlockHash(blockNumber - 1);
    const previousBlockHeader = await client.rpc.chain.getHeader(previousBlockHash);
    const previousBlockFrameId = MiningFrames.getForHeader(client, previousBlockHeader) ?? 0;
    return previousBlockFrameId < blockFrameId;
  }

  private async getFrameStartBlockNumbers(api: ApiDecoration<'promise'>): Promise<number[]> {
    const frameStartBlockNumbers = await api.query.miningSlot.frameStartBlockNumbers();
    return frameStartBlockNumbers.map(x => x.toNumber());
  }

  private async getGenesisTick(client: ArgonClient): Promise<number> {
    return await client.query.ticks.genesisTick().then((x: { toNumber: () => number }) => x.toNumber());
  }
}
