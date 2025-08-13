import { exec } from 'child_process';

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

  static async getBitcoinBlockNumbers(): Promise<IBlockNumbers> {
    return new Promise(resolve => {
      exec('docker exec server-bitcoin-1 latestblocks.sh', (error, stdout, stderr) => {
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
