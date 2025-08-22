import * as fs from 'fs';
import * as Path from 'path';
import NetworkConfig from '../core/network.config.json';
import { ArgonClient, FrameCalculator, getClient } from '@argonprotocol/mainchain';

(async () => {
  const dirname = Path.join(import.meta.dirname, '..', 'core');
  for (const [name, config] of Object.entries(NetworkConfig)) {
    try {
      console.log(`Updating ${name}: ${config.archiveUrl}`);
      const client = (await Promise.race([
        getClient(config.archiveUrl),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 1e3)),
      ])) as ArgonClient;
      const miningConfig = await new FrameCalculator().load(client);
      Object.assign(config, miningConfig);
      await client.disconnect();
    } catch (e) {
      console.warn(`[${name}]: ${e}`);
    }
  }
  fs.writeFileSync(Path.join(dirname, 'network.config.json'), JSON.stringify(NetworkConfig, null, 2), 'utf-8');
  console.log('Updated network.config.json with latest mining configuration');
  process.exit(0);
})();
