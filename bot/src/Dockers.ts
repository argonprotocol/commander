import { exec } from 'child_process';

export interface IBlockNumbers {
  localNode: number;
  mainNode: number;
}

export class Dockers {
  static async getArgonBlockNumbers(): Promise<IBlockNumbers> {
    return new Promise(resolve => {
      exec('docker exec deploy-argon-miner-1 latestblocks.sh', (error, stdout, stderr) => {
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

  static async getBitcoinBlockNumbers(): Promise<IBlockNumbers> {
    return new Promise(resolve => {
      exec('docker exec deploy-bitcoin-1 latestblocks.sh', (error, stdout, stderr) => {
        if (error) {
          console.error(`getBitcoinBlockNumbers Error: ${error.message}`);
          resolve({ localNode: 0, mainNode: 0 });
          return;
        }
        if (stderr) {
          console.error(`getBitcoinBlockNumbers Stderr: ${stderr}`);
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
}
