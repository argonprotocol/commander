import { type ArgonClient, getTickFromHeader } from '@argonprotocol/mainchain';
import { MainchainClients } from './MainchainClients.js';
import { FrameIterator } from './FrameIterator.js';
import { MiningFrames } from './MiningFrames.js';

export class StorageFinder {
  static async iterateFindStorageAddition(args: {
    client: ArgonClient;
    startingBlock: number;
    maxBlocksToCheck: number;
    storageKey: string;
  }): Promise<IBlockMeta & { blocksChecked: number[] }> {
    const { client, startingBlock, storageKey, maxBlocksToCheck } = args;
    const blocksChecked: number[] = [];
    let firstBlock = startingBlock;
    while (await this.checkIfStorageExists({ client, blockNumber: firstBlock, storageKey })) {
      firstBlock--;

      if (startingBlock - firstBlock > 100) {
        throw new Error(
          `StorageFinder cannot find a block within 100 blocks of ${startingBlock} where storage does not exist`,
        );
      }
    }
    for (let i = firstBlock; i < startingBlock + maxBlocksToCheck; i++) {
      const storageExists = await this.checkIfStorageExists({ client, blockNumber: i, storageKey });
      blocksChecked.push(i);
      if (storageExists) {
        const blockHash = await client.rpc.chain.getBlockHash(i);
        const header = await client.rpc.chain.getHeader(blockHash);
        const tick = getTickFromHeader(client, header)!;

        return {
          blocksChecked,
          blockNumber: i,
          blockHash,
          tick,
        };
      }
    }
    throw new Error(`StorageFinder cannot find storage added ${storageKey}`);
  }

  static async binarySearchForStorageAddition(
    clients: MainchainClients,
    storageKey: string,
    oldestBlockNumber?: number,
  ): Promise<IBlockMeta & { blocksChecked: number[] }> {
    const name = 'StorageFinder';
    const oldestFrame = new FrameIterator(clients, name);
    const client = await clients.archiveClientPromise;
    let blockWithoutStorage: IBlockMeta | undefined;
    const startBlock = await client.rpc.chain.getHeader();
    const valueExistsAtStart = await this.checkIfStorageExists({
      client,
      storageKey,
      blockHash: startBlock.hash,
      blockNumber: startBlock.number.toNumber(),
    });
    if (!valueExistsAtStart) {
      throw new Error('Storage not found');
    }
    let maxBlockNumberForExistence = startBlock.number.toNumber();
    await oldestFrame.forEachFrame(async (_frameId, firstBlockMeta, _api, abortController) => {
      console.log(`[${name}] Checking frame starting at block ${firstBlockMeta.blockNumber}`);
      const existsAtHeight = await this.checkIfStorageExists({ client, ...firstBlockMeta, storageKey });

      if (!existsAtHeight) {
        abortController.abort();
        blockWithoutStorage = {
          blockHash: firstBlockMeta.blockHash,
          blockNumber: firstBlockMeta.blockNumber,
          tick: firstBlockMeta.blockTick,
        };
      } else if (oldestBlockNumber && firstBlockMeta.blockNumber < oldestBlockNumber) {
        console.log(`[${name}] Reached user-specified oldest block ${oldestBlockNumber}`);
        abortController.abort();
        return;
      }
      maxBlockNumberForExistence = Math.min(firstBlockMeta.blockNumber, maxBlockNumberForExistence);
    });
    if (!blockWithoutStorage) {
      throw new Error('Storage not found after recursing frames');
    }
    // binary search to the first block where the storage exists
    let lowBlockNumberForExistence = blockWithoutStorage.blockNumber;
    const blocksChecked: number[] = [];
    while (lowBlockNumberForExistence < maxBlockNumberForExistence) {
      const mid = Math.floor((lowBlockNumberForExistence + maxBlockNumberForExistence) / 2);
      blocksChecked.push(mid);
      const exists = await this.checkIfStorageExists({ client, blockNumber: mid, storageKey });
      if (!exists) {
        lowBlockNumberForExistence = mid + 1; // doesn't exist, move up
      } else {
        maxBlockNumberForExistence = mid; // found present, move down
      }
    }
    blocksChecked.push(lowBlockNumberForExistence);
    const blockNumber = lowBlockNumberForExistence;
    const blockHash = await client.rpc.chain.getBlockHash(blockNumber);
    if (!blockHash) {
      throw new Error('Storage not found');
    }
    const header = await client.rpc.chain.getHeader(blockHash);
    console.log(`[${name}] Found in block ${blockNumber}`);
    const tick = getTickFromHeader(client, header)!;
    return {
      blocksChecked,
      blockHash,
      blockNumber,
      tick,
    };
  }

  static async checkIfStorageExists(args: {
    client: ArgonClient;
    blockNumber: number;
    storageKey: string;
    blockHash?: Uint8Array;
  }): Promise<boolean> {
    const { client, blockNumber, storageKey, blockHash: givenBlockHash } = args;
    const blockHash = givenBlockHash ?? (await client.rpc.chain.getBlockHash(blockNumber));
    const size = await client.rpc.state.getStorageSize(storageKey, blockHash);
    return size.toNumber() > 0;
  }
}

interface IBlockMeta {
  blockHash: Uint8Array;
  blockNumber: number;
  tick: number;
}
