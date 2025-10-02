import { configDotenv } from 'dotenv';
import Path from 'node:path';
import { execSync } from 'node:child_process';
import { readFileSync } from 'fs';
import { writeFileSync } from 'node:fs';

const __dirname = Path.dirname(new URL(import.meta.url).pathname);

const res = configDotenv({ path: Path.join(__dirname, '.env') });
const networkName = res.parsed.ARGON_CHAIN ?? 'dev-docker';
execSync('yarn build:config', {
  stdio: 'inherit',
  cwd: Path.join(__dirname, '../..'),
  env: { ...process.env, ARGON_NETWORK_NAME: networkName },
});

const esploraPort = execSync('docker compose port bitcoin-electrs 3002', {
  cwd: __dirname,
  encoding: 'utf-8',
})
  .trim()
  .split(':')
  .pop();

const configPath = Path.join(__dirname, '../../core/network.config.json');
const networkJson = readFileSync(configPath, 'utf-8');
const networkConfig = JSON.parse(networkJson);
networkConfig[networkName].esploraHost = `http://localhost:${esploraPort}`;
writeFileSync(configPath, JSON.stringify(networkConfig, null, 2) + '\n', 'utf-8');
