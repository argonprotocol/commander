import { expect } from 'vitest';
import fs from 'node:fs';

(async () => {
  const force = process.argv.includes('--force') || process.argv.includes('-f');
  if (!force && fs.existsSync('docker-compose.yml')) {
    console.log('docker-compose.yml already exists. Use --force to overwrite.');
    return;
  }
  const dockerfile = await fetch(
    `https://raw.githubusercontent.com/argonprotocol/mainchain/refs/heads/main/docker-compose.yml`,
  );
  expect(dockerfile.ok).toBeTruthy();
  const file = await dockerfile.text();
  await fs.promises.writeFile('docker-compose.yml', file);
})();
