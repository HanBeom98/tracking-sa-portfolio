import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sources = {
  'application/replay-coaching-preview.js': 'preview.mjs',
  'domain/replay-coaching-response.js': 'response.mjs',
  'domain/replay-review-response.js': 'review-response.mjs',
};
export function syncReplayCoachingModules(root, { check = false } = {}) {
  for (const [source, target] of Object.entries(sources)) {
    const from = path.join(root, 'src/domains/stats/sudden-attack/replay', source);
    const to = path.join(root, 'cloud-functions/replay-coaching-shared', target);
    const content = fs.readFileSync(from, 'utf8').replaceAll('\r\n', '\n');
    if (check) {
      if (!fs.existsSync(to) || fs.readFileSync(to, 'utf8').replaceAll('\r\n', '\n') !== content) throw new Error(`Replay server mirror is stale: ${target}. Run npm run build.`);
    } else {
      fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, content);
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  syncReplayCoachingModules(process.cwd(), { check: process.argv.includes('--check') });
  console.log('[replay-server-mirrors] OK');
}
