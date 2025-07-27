import * as fs from 'fs';
import * as path from 'path';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { getClient, JsonExt } from '@argonprotocol/mainchain';
import { Vaults } from '../src-vue/lib/Vaults.ts';
import { setMainchainClient } from '../src-vue/stores/mainchain.ts';

dayjs.extend(utc);

export default async function fetchVaultRevenue() {
  for (const chain of ['testnet', 'mainnet'] as const) {
    const url = chain === 'mainnet' ? 'wss://rpc.argon.network' : 'wss://rpc.testnet.argonprotocol.org';
    setMainchainClient(getClient(url));
    const vaults = new Vaults(chain);
    await vaults.load();
    const data = await vaults.refreshRevenue();

    // Write data to JSON file
    const filePath = path.join(process.cwd(), 'src-vue', 'data', `vaultRevenue.${chain}.json`);
    console.log(`Writing data to: ${filePath}`);

    const fileDir = path.dirname(filePath);
    if (!fs.existsSync(fileDir)) {
      console.log(`Creating directory: ${fileDir}`);
      fs.mkdirSync(fileDir, { recursive: true });
    }

    fs.writeFileSync(filePath, JsonExt.stringify(data, 2));
    console.log(`Successfully saved Vault revenue data`);
  }
}
