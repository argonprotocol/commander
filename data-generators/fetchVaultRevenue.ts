import './_globals.js';
import * as fs from 'fs';
import * as path from 'path';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import { getClient, JsonExt } from '@argonprotocol/mainchain';
import { Vaults } from '../src-vue/lib/Vaults.ts';
import { Mainchain } from '@argonprotocol/commander-calculator';
import { setMainchainClient } from '../src-vue/stores/mainchain.ts';

dayjs.extend(utc);

const rebuildBaseline = Boolean(JSON.parse(process.env.REBUILD_BASELINE ?? '0'));

export default async function fetchVaultRevenue() {
  for (const chain of ['testnet', 'mainnet'] as const) {
    const url = chain === 'mainnet' ? 'wss://rpc.argon.network' : 'wss://rpc.testnet.argonprotocol.org';
    const mainchain = new Mainchain(getClient(url));
    setMainchainClient(mainchain.client);
    const vaults = new Vaults(chain);
    await vaults.load();
    const data = await vaults.refreshRevenue(mainchain);

    // Write data to JSON file
    const filePath = path.join(process.cwd(), 'src-vue', 'data', `vaultRevenue.${chain}.json`);
    console.log(`Writing data to: ${filePath}`);

    const fileDir = path.dirname(filePath);
    if (!fs.existsSync(fileDir)) {
      console.log(`Creating directory: ${fileDir}`);
      fs.mkdirSync(fileDir, { recursive: true });
    }

    if (rebuildBaseline) {
      const client = await mainchain.client;
      const utxos = await client.query.bitcoinLocks.locksByUtxoId.entries();
      for (const [_utxoId, utxo] of utxos) {
        const vaultId = utxo.unwrap().vaultId.toNumber();
        const satoshis = utxo.unwrap().satoshis.toBigInt();
        const lockPrice = utxo.unwrap().lockPrice.toBigInt();
        const vaultStats = data.vaultsById[vaultId].baseline;
        vaultStats.bitcoinLocks += 1;
        vaultStats.satoshis += satoshis;
        vaultStats.microgonLiquidityRealized += lockPrice;
        vaultStats.feeRevenue += vaults.vaultsById[vaultId].calculateBitcoinFee(lockPrice);
      }
    }

    fs.writeFileSync(filePath, JsonExt.stringify(data, 2));
    console.log(`Successfully saved Vault revenue data`);
  }
}
