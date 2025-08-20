import * as tar from 'tar';
import * as fs from 'fs';
import * as Path from 'path';
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import { version as packageVersion } from '../package.json';

(async () => {
  const files = fs.readdirSync('../resources');
  const serverFiles = files.filter(file => file.startsWith('server-') || file === 'SHASUM256');
  for (const file of serverFiles) {
    fs.unlinkSync(Path.join('resources', file));
  }
  const version = `${packageVersion}`;
  const fileName = `server-${version}.tar.gz`;
  const filePath = Path.join('resources', fileName);
  await tar.create(
    {
      gzip: { mtime: 0 } as any,
      portable: true,
      noMtime: true, // need for deterministic hashes
      file: filePath,
      cwd: './server',
    },
    [''],
  );

  // Compute SHA256 checksum
  const hash = createHash('sha256');
  const fileStream = fs.createReadStream(filePath);
  await pipeline(fileStream, hash);

  const checksum = hash.digest('hex');
  console.log(`SHA256: ${checksum}`);
  fs.writeFileSync(`../resources/SHASUM256`, `${checksum}  ${fileName}\n`);
})();
