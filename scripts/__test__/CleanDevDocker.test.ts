import { execFileSync } from 'node:child_process';
import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

describe('clean dev docker', () => {
  let testDir: string | undefined;

  afterEach(() => {
    if (testDir) Fs.rmSync(testDir, { recursive: true, force: true });
  });

  it.skipIf(process.platform === 'win32')(
    'removes only the Ethereum enclave recorded by this checkout',
    () => {
      testDir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'argon-clean-dev-docker-'));
      const binDir = Path.join(testDir, 'bin');
      const runtimeStateDir = Path.join(testDir, 'ethereum-state');
      const removalsPath = Path.join(testDir, 'removed-enclaves.txt');
      Fs.mkdirSync(binDir, { recursive: true });
      Fs.mkdirSync(runtimeStateDir, { recursive: true });
      Fs.writeFileSync(
        Path.join(runtimeStateDir, 'latest.json'),
        JSON.stringify({
          beaconPreset: 'minimal',
          enclaveName: 'argon-eth-owned',
          executionRpcUrl: 'http://127.0.0.1:32003',
          beaconApiUrl: 'http://127.0.0.1:33001',
          chainId: '0x301824',
          serverExecutionRpcUrl: 'http://host.docker.internal:32003/',
          serverBeaconApiUrl: 'http://host.docker.internal:33001/',
          usdcTokenAddress: '0x5fbdb2315678afecb367f032d93f642f64180aa3',
          setupStatus: 'ready',
          updatedAt: '2026-09-04T12:00:00.000Z',
        }),
      );
      writeExecutable(
        Path.join(binDir, 'kurtosis'),
        `#!/bin/sh
if [ "$1" = "enclave" ] && [ "$2" = "ls" ]; then
  printf 'UUID Name Status Creation Time\\n1 argon-eth-owned RUNNING now\\n2 argon-eth-foreign RUNNING now\\n'
elif [ "$1" = "enclave" ] && [ "$2" = "rm" ]; then
  printf '%s\\n' "$4" >> "$KURTOSIS_REMOVALS"
fi
`,
      );
      writeExecutable(
        Path.join(binDir, 'docker'),
        `#!/bin/sh
if [ "$1" = "network" ] && [ "$2" = "inspect" ]; then
  printf '[]'
fi
`,
      );
      writeExecutable(Path.join(binDir, 'ps'), '#!/bin/sh\n');

      execFileSync(process.execPath, [Path.resolve('node_modules/tsx/dist/cli.mjs'), 'scripts/cleanDevDocker.ts'], {
        cwd: Path.resolve('.'),
        env: {
          ...process.env,
          ARGON_APP_INSTANCE: `cleanup-test-${process.pid}`,
          ARGON_DEV_ETHEREUM_RUNTIME_STATE_DIR: runtimeStateDir,
          ARGON_DEV_UPSTREAM_DIR: Path.join(testDir, 'upstream'),
          ARGON_NETWORK_NAME: 'dev-docker',
          COMPOSE_PROJECT_NAME: `dev-docker-cleanup-test-${process.pid}`,
          KURTOSIS_REMOVALS: removalsPath,
          PATH: `${binDir}${Path.delimiter}${process.env.PATH}`,
        },
        stdio: 'pipe',
      });

      expect(Fs.readFileSync(removalsPath, 'utf8').trim().split('\n')).toEqual(['argon-eth-owned']);
    },
    15_000,
  );
});

function writeExecutable(filePath: string, contents: string): void {
  Fs.writeFileSync(filePath, contents, { mode: 0o755 });
}
