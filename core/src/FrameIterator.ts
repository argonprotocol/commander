import type { ApiDecoration } from '@polkadot/api/types';
import type { MainchainClients } from './MainchainClients.js';
import type { ArgonClient } from '@argonprotocol/mainchain';

export class FrameIterator {
  constructor(
    private readonly clients: MainchainClients,
    readonly iterateByEpoch: boolean = false,
  ) {}

  public async forEachFrame<T>(
    callback: (
      justEndedFrameId: number,
      api: ArgonClient,
      meta: {
        blockNumber: number;
        specVersion: number;
      },
      abortController: AbortController,
    ) => Promise<T>,
  ): Promise<T[]> {
    const archiveClient = await this.clients.archiveClientPromise;
    const abortController = new AbortController();
    const seenFrames = new Set<number>();
    const results: T[] = [];

    let api = archiveClient as ApiDecoration<'promise'>;
    let apiSpecVersion = api.runtimeVersion.specVersion.toNumber();
    let frameStartBlockNumbers = await this.getFrameStartBlockNumbers(api);
    let startingFrameId = await api.query.miningSlot.nextFrameId().then(x => x.toNumber() - 1);

    for (let i = 0; i < frameStartBlockNumbers.length; i++) {
      const currentFrameId = startingFrameId - i;
      const blockNumber = frameStartBlockNumbers[i];
      const hasAlreadySeenThisFrame = seenFrames.has(currentFrameId);
      let shouldIterateThisFrame = !hasAlreadySeenThisFrame;
      if (this.iterateByEpoch) {
        shouldIterateThisFrame = i === 0 && !hasAlreadySeenThisFrame;
      }

      const iterateThisFrame = async () => {
        console.log(`Exploring frame ${currentFrameId}`);
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
        const nextBlockHash = await archiveClient.rpc.chain.getBlockHash(blockNumber - 1);
        const nextApi = await archiveClient.at(nextBlockHash);
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

  private async getFrameStartBlockNumbers(api: ApiDecoration<'promise'>): Promise<number[]> {
    const frameStartBlockNumbers = await api.query.miningSlot.frameStartBlockNumbers();
    return frameStartBlockNumbers.map(x => x.toNumber());
  }
}
