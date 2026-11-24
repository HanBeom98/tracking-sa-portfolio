import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { startLocalServer } from './local-server.mjs';
import service from '../../cloud-functions/replay-coaching-service.js';

// This adapter exists only in the emulator test runner, never in public output.
const require = createRequire(new URL('../emulator/run-tests.mjs', import.meta.url));
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const authOrigin = 'http://127.0.0.1:9098';
const projectId = 'demo-trackingsa-ownership';
export default async function setup() {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085'
    || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9098') throw new Error('Local emulators required');
  const env = await initializeTestEnvironment({ projectId,
    firestore: { host: '127.0.0.1', port: 8085, rules: await readFile('firestore.rules', 'utf8') } });
  let ready, rejectReady, finish, stop;
  const started = new Promise((resolve, reject) => { ready = resolve; rejectReady = reject; });
  const running = env.withSecurityRulesDisabled(async ctx => {
    async function verifyToken(token) {
      // The Auth emulator validates the browser token. No decoded JWT is trusted.
      const result = await fetch(`${authOrigin}/identitytoolkit.googleapis.com/v1/accounts:lookup?key=local-demo-key`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }),
        signal: AbortSignal.timeout(5000),
      });
      const data = await result.json();
      if (!result.ok || !data.users?.[0]?.localId) throw new Error('Invalid emulator token');
      return { uid: data.users[0].localId };
    }
    const periodStart = Date.now() - 86400000;
    const handler = service.createReplayCoachingHandler({ db: ctx.firestore(), verifyToken, getEnv: () => ({
      REPLAY_COACHING_MODE: 'mock', REPLAY_COACHING_TEST_UIDS: [1, 2, 3, 4, 5].map(n => `coaching-tester-${n}`).join(','),
      REPLAY_COACHING_TEST_PERIOD_ID: 'local-browser-monthly',
      REPLAY_COACHING_TEST_PERIOD_START: new Date(periodStart).toISOString(),
      REPLAY_COACHING_TEST_PERIOD_END: new Date(periodStart + 30 * 86400000).toISOString(),
      REPLAY_COACHING_USER_LIMIT: '2', REPLAY_COACHING_ATTEMPT_LIMIT: '70', REPLAY_COACHING_GLOBAL_MONTHLY: '3',
      REPLAY_COACHING_GLOBAL_UNITS: '15', REPLAY_COACHING_UNITS_PER_REQUEST: '5',
    }) });
    stop = await startLocalServer(async (request, response, pathname) => {
      if (pathname !== '/api/replay-coaching') return false;
      if (request.headers.origin && request.headers.origin !== 'http://127.0.0.1:4173') {
        response.writeHead(403).end(); return true;
      }
      let size = 0; const chunks = [];
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 12288) { response.writeHead(413, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'BODY_TOO_LARGE' })); return true; }
        chunks.push(chunk);
      }
      // The loopback-only adapter stands in for the production origin. Production
      // CORS remains unchanged; the handler never accepts a localhost origin there.
      const req = { method: request.method, headers: { ...request.headers, origin: 'https://trackingsa.com' }, rawBody: Buffer.concat(chunks) };
      const res = { set: (k, v) => { response.setHeader(k, v); return res; }, status: n => { response.statusCode = n; return res; },
        json: value => { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(value)); }, send: v => response.end(v) };
      await handler(req, res); return true;
    });
    ready(); await new Promise(resolve => { finish = resolve; });
  });
  running.catch(rejectReady);
  await started;
  return async () => { await stop(); finish(); await running; await env.cleanup(); };
}
