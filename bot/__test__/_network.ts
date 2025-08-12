import * as docker from 'docker-compose';
import Path from 'node:path';
import { runOnTeardown } from '@argonprotocol/testing';

export async function startNetwork(options?: { shouldLog: boolean }): Promise<{ archiveUrl: string }> {
  const env = {
    VERSION: 'dev',
    ARGON_CHAIN: 'dev-docker',
    BITCOIN_BLOCK_SECS: '20',
    PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin`,
  };
  await docker.upAll({
    cwd: Path.resolve(__dirname, '../..'),
    log: options?.shouldLog ?? false,
    commandOptions: [`--force-recreate`, `--remove-orphans`],
    env,
  });
  const portResult = await docker.port('archive-node', '9944');
  const port = portResult.data.port;
  runOnTeardown(async () => {
    await docker.downAll({
      cwd: Path.resolve(__dirname, '../..'),
      log: options?.shouldLog ?? false,
      commandOptions: [`--volumes`],
    });
  });
  return { archiveUrl: `ws://localhost:${port}` };
}
