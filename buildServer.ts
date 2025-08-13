import * as tar from 'tar';
import * as fs from 'fs';
import * as Path from 'path';
import { createHash } from 'crypto';
import { pipeline } from 'stream/promises';
import { version as packageVersion } from './package.json';

(async () => {
  const ts = (Date.now() / 1000).toFixed();
  const files = fs.readdirSync('./resources');
  const serverFiles = files.filter(file => file.startsWith('server-') || file === 'VERSION');
  for (const file of serverFiles) {
    fs.unlinkSync(Path.join('resources', file));
  }
  const version = `${packageVersion}-${ts}`;
  const fileName = `resources/server-${version}.tar.gz`;
  fs.writeFileSync(`./server/VERSION`, `${version}`);
  fs.writeFileSync(`./resources/VERSION`, `${version}`);
  await tar.create(
    {
      gzip: true,
      file: fileName,
      cwd: './server',
    },
    [''],
  );

  // Compute SHA256 checksum
  const hash = createHash('sha256');
  const fileStream = fs.createReadStream(fileName);
  await pipeline(fileStream, hash);

  const checksum = hash.digest('hex');
  console.log(`SHA256: ${checksum}`);
  fs.writeFileSync(`${fileName}.sha256`, `${checksum}  ${fileName}\n`);
})();
