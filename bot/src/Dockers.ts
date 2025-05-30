import { exec } from 'child_process';

export class Dockers {
  static async getArgonBlockNumbers(): Promise<[number, number]> {
    return new Promise((resolve) => {
      exec('docker exec deploy-argon-miner-1 latestblocks.sh', (error, stdout, stderr) => {
        if (error) {
          console.error(`getArgonBlockNumbers Error: ${error.message}`);
          resolve([0, 0]);
          return;
        }
        if (stderr) {
          console.error(`getArgonBlockNumbers Stderr: ${stderr}`);
          resolve([0, 0]);
          return;
        }
        const [localhostBlockNumber, mainchainBlockNumber] = stdout.split('-');
        resolve([parseInt(localhostBlockNumber), parseInt(mainchainBlockNumber)]);
      });
    });
  }

  static async getBitcoinBlockNumbers(): Promise<[number, number]> {
    return new Promise((resolve) => {
      exec('docker exec deploy-bitcoin-1 latestblocks.sh', (error, stdout, stderr) => {
        if (error) {
          console.error(`getBitcoinBlockNumbers Error: ${error.message}`);
          resolve([0, 0]);
          return;
        }
        if (stderr) {
          console.error(`getBitcoinBlockNumbers Stderr: ${stderr}`);
          resolve([0, 0]);
          return;
        }
        const [localhostBlockNumber, mainchainBlockNumber] = stdout.split('-');
        resolve([parseInt(localhostBlockNumber), parseInt(mainchainBlockNumber)]);
      });
    });
  }
}