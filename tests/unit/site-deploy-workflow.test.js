import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("site deploy requires the shared validation workflow before deployment", () => {
  const workflow = readFileSync(".github/workflows/site-deploy.yml", "utf8");

  assert.match(workflow, /needs:\s*test/);
  assert.match(workflow, /test:\s*\n\s*uses: \.\/\.github\/workflows\/validate\.yml/);
  assert.equal((workflow.match(/node-version:\s*"24"/g) || []).length, 1);
  assert.doesNotMatch(workflow, /paths-filter|Run Targeted Unit Tests|steps\.filter/);
});

test("PR and reusable deployment validation cover unit, boundaries, Python, fresh builds, browser and actual rules", () => {
  const workflow = readFileSync(".github/workflows/validate.yml", "utf8");
  for (const event of ["pull_request", "workflow_dispatch", "workflow_call"]) {
    assert.match(workflow, new RegExp(`^  ${event}:`, "m"));
  }
  for (const command of ["check:public-edit-policy", "check:source-of-truth", "check:application-browser-boundary", "check:source-graph", "test:unit", "check:build-artifacts", "test:e2e:ci", "test:emulator", "test:e2e:auth:local"]) {
    assert.ok(workflow.includes(`npm run ${command}`), `Missing CI guard: ${command}`);
  }
  assert.ok(workflow.includes("npm run test:python"));
  assert.ok(workflow.indexOf("npm run check:build-artifacts") > workflow.indexOf("npm run build"));
  assert.doesNotMatch(workflow, /continue-on-error|paths-ignore|paths-filter/);
});

test("automatic validation uses local demo services and cannot deploy with production secrets", () => {
  const workflow = readFileSync(".github/workflows/validate.yml", "utf8");
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(workflow, /secrets\.|secrets: inherit|pull_request_target|firebase deploy|pages deploy/);
  const manifest = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(manifest.scripts["test:emulator"], "node tests/emulator/run-tests.mjs");
  const runner = readFileSync("tests/emulator/run-tests.mjs", "utf8");
  assert.match(runner, /"--project", "demo-trackingsa-ownership"/);
  assert.match(runner, /browserMode \? "auth,firestore,storage" : "firestore,storage"/);
  assert.match(runner, /--test-concurrency=1/);
  const config = JSON.parse(readFileSync("tests/emulator/firebase.json", "utf8"));
  for (const service of ["auth", "firestore", "storage"]) assert.equal(config.emulators[service].host, "127.0.0.1");
});

test("main pushes run shared validation once through the production deployment workflow", () => {
  const deploy = readFileSync(".github/workflows/site-deploy.yml", "utf8");
  const validate = readFileSync(".github/workflows/validate.yml", "utf8");
  assert.match(deploy, /^  push:\s*\n\s*branches: \[main\]/m);
  assert.match(deploy, /^  workflow_dispatch:/m);
  assert.match(deploy, /test:\s*\n\s*uses: \.\/\.github\/workflows\/validate\.yml/);
  assert.doesNotMatch(validate, /^  push:/m);
  assert.doesNotMatch(deploy, /secrets: inherit|continue-on-error/);
});

test("production upload is main-only and refuses an obsolete commit before remote mutations", () => {
  const workflow = readFileSync(".github/workflows/site-deploy.yml", "utf8");
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main' && github\.repository == 'HanBeom98\/tracking-sa'/);
  const guard = workflow.indexOf("- name: Verify latest main commit before remote mutations");
  assert.ok(guard > workflow.indexOf("run: npm run check:build-artifacts"));
  for (const name of ["Deploy Firestore Rules and Indexes", "Audit and clean legacy board emails", "Deploy to Cloudflare Pages"]) {
    assert.ok(workflow.indexOf(`- name: ${name}`) > guard);
  }
  assert.ok(workflow.includes('git/ref/heads/main'));
  assert.ok(workflow.includes('if [ "$GITHUB_SHA" != "$latest_main" ]; then'));
  assert.ok(workflow.includes('--commit-hash=${{ github.sha }}'));
  assert.ok(workflow.includes('persist-credentials: false'));
});

test("automatic site uploads do not deploy Firebase rules or run board email cleanup", () => {
  const workflow = readFileSync(".github/workflows/site-deploy.yml", "utf8");
  const steps = workflow.replace(/\r\n/g, "\n").split("      - name: ");
  for (const name of ["Install Firebase CLI", "Deploy Firestore Rules and Indexes", "Audit and clean legacy board emails"]) {
    const step = steps.find(value => value.startsWith(name + "\n"));
    assert.ok(step, `Missing manual operation: ${name}`);
    assert.ok(step.includes("github.event_name == 'workflow_dispatch'"), `${name} must stay manual`);
  }
  assert.ok(steps.find(value => value.startsWith("Audit and clean legacy board emails\n"))
    .includes("inputs.board_privacy_cleanup != 'none'"));
});
