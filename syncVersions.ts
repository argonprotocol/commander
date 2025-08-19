import * as fs from 'fs';
import * as Path from 'path';
import { version as packageVersion } from './package.json';

(async () => {
  const dirname = import.meta.dirname;
  for (const name of ['src-tauri/tauri.conf.json', 'src-tauri/tauri.experimental.conf.json']) {
    const filePath = Path.join(dirname, 'src-tauri', name);
    const file = fs.readFileSync(filePath, 'utf-8');
    const tauriConf = JSON.parse(file);
    tauriConf.version = packageVersion;
    fs.writeFileSync(filePath, JSON.stringify(tauriConf, null, 2));
  }
})();
