import * as fs from 'node:fs';
import { version as packageVersion } from '../package.json';

const rawVersion = process.argv[2] || packageVersion;
// normalize: strip leading v, but match with or without
const version = rawVersion.replace(/^v/, '').trim();

(async () => {
  const dirname = import.meta.dirname;
  const releaseNotes = fs.readFileSync(`${dirname}/../RELEASE_NOTES.md`, 'utf8');
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Match "## vX.Y.Z..." or "## X.Y.Z..." with any extra text until newline
  const rx = new RegExp(`^##\\s+\\[?v?${esc(version)}\\]?\\s*(?:-.*)?\\n([\\s\\S]*?)(?=^##\\s|\\Z)`, 'm');

  const m = releaseNotes.match(rx);
  if (!m) {
    console.error(`Release notes for version ${rawVersion} not found.`);
    process.exit(1);
  }
  const notes = m[1].trim();
  console.log(notes);
})();
