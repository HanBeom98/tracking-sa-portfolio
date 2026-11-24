import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const FUNCTION_IDS = ['cleanupBoardPostComments', 'discordMatchSession'];

export function verifyFunctionRuntimes(payload, { runtime, project = 'demo-tracking-sa-portfolio', region = 'asia-northeast3' }) {
  if (payload?.status !== 'success' || !Array.isArray(payload.result)) throw new Error('Unable to read deployed function inventory');
  return FUNCTION_IDS.map((id) => {
    const matches = payload.result.filter((entry) => entry.id === id && entry.project === project && entry.region === region);
    if (matches.length !== 1 || matches[0].platform !== 'gcfv2' || matches[0].runtime !== runtime) {
      throw new Error(`Deployed runtime mismatch: ${id} (${region}), expected ${runtime}`);
    }
    // functions:list also returns environment variables. Log only this allowlist.
    return { id, project, region, platform: matches[0].platform, runtime: matches[0].runtime };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = JSON.parse(readFileSync('firebase.json', 'utf8'));
    const payload = JSON.parse(readFileSync(process.argv[2], 'utf8'));
    for (const result of verifyFunctionRuntimes(payload, { runtime: config.functions.runtime })) {
      console.log('Verified deployed function:', JSON.stringify(result));
    }
  } catch (error) {
    console.error('Function runtime verification failed:', error instanceof SyntaxError ? 'Invalid CLI JSON output' : error.message);
    process.exitCode = 1;
  }
}
