import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyFunctionRuntimes } from '../../scripts/verify-functions-runtime.mjs';

test("deleted board posts trigger server-side comment cleanup", () => {
  const firebaseConfig = JSON.parse(readFileSync("firebase.json", "utf8"));
  const source = readFileSync("cloud-functions/index.js", "utf8");

  assert.equal(firebaseConfig.functions.source, "cloud-functions");
  assert.ok(source.includes('document: "board_posts/{postId}"'));
  assert.ok(source.includes('.collection("comments")'));
  assert.ok(source.includes("batch.delete(doc.ref)"));
});

test('Firebase deployment, function package, lockfile and CI use the same Node major', () => {
  const firebaseConfig = JSON.parse(readFileSync('firebase.json', 'utf8'));
  const packagePath = `${firebaseConfig.functions.source}/package.json`;
  const manifest = JSON.parse(readFileSync(packagePath, 'utf8'));
  const lock = JSON.parse(readFileSync(`${firebaseConfig.functions.source}/package-lock.json`, 'utf8'));
  const workflow = readFileSync('.github/workflows/functions-deploy.yml', 'utf8');
  const major = manifest.engines.node;
  assert.match(major, /^\d+$/);
  assert.equal(firebaseConfig.functions.runtime, `nodejs${major}`);
  assert.equal(lock.packages[''].engines.node, major);
  assert.ok(workflow.includes(`node-version-file: ${packagePath}`));
  assert.doesNotMatch(workflow, /\bnode-version:/);
  assert.ok(workflow.includes('TRACKING_SA_FUNCTIONS_NODE_CHECK: "1"'));
  assert.ok(workflow.includes('npm run test:unit'));
  assert.ok(workflow.includes('node scripts/verify-functions-runtime.mjs'));
  const source = readFileSync(`${firebaseConfig.functions.source}/index.js`, 'utf8');
  for (const [, id] of source.matchAll(/exports\.(\w+)\s*=/g)) {
    // Coaching endpoints stay dormant until separately configured/deployed.
    if (['replayCoachingPreview', 'replayCoachingReview', 'replayPurchaseTest', 'replayPurchase'].includes(id)) {
      assert.ok(!workflow.includes(`functions:${id}`), 'Dormant coaching API must not join routine deployments');
      continue;
    }
    assert.ok(workflow.includes(`functions:${id}`), `Explicit deploy target required for runtime-only updates: ${id}`);
  }
  if (process.env.TRACKING_SA_FUNCTIONS_NODE_CHECK === '1') {
    assert.equal(process.versions.node.split('.')[0], major, 'Functions CI must test on the deployed Node major');
  }
});

const inventory = () => ({ status: 'success', result: ['cleanupBoardPostComments', 'discordMatchSession'].map((id) => ({
  id, project: 'demo-tracking-sa-portfolio', region: 'asia-northeast3', platform: 'gcfv2', runtime: 'nodejs22',
  environmentVariables: { PRIVATE_VALUE: 'must-not-appear-in-verification-output' },
})) });

test('deployed function verification reports both runtimes without environment variables', () => {
  const result = verifyFunctionRuntimes(inventory(), { runtime: 'nodejs22' });
  assert.equal(result.length, 2);
  assert.equal(result[0].runtime, 'nodejs22');
  assert.equal(JSON.stringify(result).includes('PRIVATE_VALUE'), false);
});

test('deployed function verification rejects stale, missing, duplicate or wrong-project runtimes', () => {
  for (const change of [
    (payload) => { payload.result[0].runtime = 'nodejs20'; },
    (payload) => { payload.result.pop(); },
    (payload) => { payload.result.push(payload.result[0]); },
    (payload) => { payload.result[0].project = 'other-project'; },
    (payload) => { payload.result[0].region = 'other-region'; },
    (payload) => { payload.status = 'error'; },
  ]) {
    const payload = inventory(); change(payload);
    assert.throws(() => verifyFunctionRuntimes(payload, { runtime: 'nodejs22' }));
  }
});
