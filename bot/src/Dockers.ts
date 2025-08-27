import { exec } from 'child_process';
import type { IBitcoinBlockMeta } from '@argonprotocol/commander-core';

export interface IBlockNumbers {
  localNode: number;
  mainNode: number;
}

export class Dockers {
  static async getArgonBlockNumbers(): Promise<IBlockNumbers> {
    return new Promise(resolve => {
      exec('docker exec server-argon-miner-1 latestblocks.sh', (error, stdout, stderr) => {
        if (error) {
          console.error(`getArgonBlockNumbers Error: ${error.message}`);
          resolve({ localNode: 0, mainNode: 0 });
          return;
        }
        if (stderr) {
          console.error(`getArgonBlockNumbers Stderr: ${stderr}`);
          resolve({ localNode: 0, mainNode: 0 });
          return;
        }
        const [localNodeBlockNumber, mainNodeBlockNumber] = stdout.split('-');
        resolve({
          localNode: parseInt(localNodeBlockNumber),
          mainNode: parseInt(mainNodeBlockNumber),
        });
      });
    });
  }

  static async isArgonMinerReady(): Promise<boolean> {
    return new Promise(resolve => {
      exec('docker exec server-argon-miner-1 iscomplete.sh', (error, stdout, stderr) => {
        if (error) {
          console.error(`isArgonMinerReady Error: ${error.message}`);
          resolve(false);
          return;
        }
        if (stderr) {
          console.error(`isArgonMinerReady Stderr: ${stderr}`);
          resolve(false);
          return;
        }
        resolve(stdout.trim() === 'true');
      });
    });
  }

  static async getBitcoinBlockNumbers(): Promise<IBlockNumbers & { localNodeBlockTime: number }> {
    return new Promise(resolve => {
      exec('docker exec server-bitcoin-1 latestblocks.sh', (error, stdout, stderr) => {
        if (error) {
          console.error(`getBitcoinBlockNumbers Error: ${error.message}`);
          resolve({ localNode: 0, mainNode: 0, localNodeBlockTime: 0 });
          return;
        }
        if (stderr) {
          console.error(`getBitcoinBlockNumbers Stderr: ${stderr}`);
          resolve({ localNode: 0, mainNode: 0, localNodeBlockTime: 0 });
          return;
        }
        const [localNodeBlockNumber, mainNodeBlockNumber, localNodeBlockTime] = stdout.split('-');
        resolve({
          localNode: parseInt(localNodeBlockNumber),
          mainNode: parseInt(mainNodeBlockNumber),
          localNodeBlockTime: parseInt(localNodeBlockTime),
        });
      });
    });
  }

  static async getBitcoinBlocktime(): Promise<number> {
    return new Promise(resolve => {
      exec('docker exec server-bitcoin-1 bitcoin-cli.sh getblockchaininfo', (error, stdout, stderr) => {
        if (error) {
          console.error(`getBitcoinBlocktime Error: ${error.message}`);
          resolve(0);
          return;
        }
        if (stderr) {
          console.error(`getBitcoinBlocktime Stderr: ${stderr}`);
          resolve(0);
          return;
        }
        try {
          const info = JSON.parse(stdout) as {
            chain: string;
            blocks: number;
            headers: number;
            bestblockhash: string;
            difficulty: number;
            time: number;
            mediantime: number;
            verificationprogress: number;
            initialblockdownload: boolean;
            chainwork: string;
            size_on_disk: number;
            pruned: boolean;
          };
          resolve(info.time);
        } catch (e) {
          console.error('getBitcoinBlocktime JSON Parse Error:', e);
          resolve(0);
        }
      });
    });
  }

  static async getBitcoinLatestBlocks(): Promise<IBitcoinBlockMeta[]> {
    return new Promise(resolve => {
      exec('docker exec server-bitcoin-1 recentblocks.sh 10', (error, stdout, stderr) => {
        if (error) {
          console.error(`getBitcoinLatestBlocks Error: ${error.message}`);
          resolve([]);
          return;
        }
        if (stderr) {
          console.error(`getBitcoinLatestBlocks Stderr: ${stderr}`);
          resolve([]);
          return;
        }
        try {
          resolve(JSON.parse(stdout.trim()) as IBitcoinBlockMeta[]);
        } catch (e) {
          console.error('getBitcoinLatestBlocks JSON Parse Error:', e);
          resolve([]);
        }
      });
    });
  }
}
