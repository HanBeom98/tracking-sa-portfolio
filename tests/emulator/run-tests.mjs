import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../../", import.meta.url));
const coachingMode = process.argv.includes("--coaching");
const browserMode = process.argv.includes("--browser") || coachingMode;
const config = JSON.parse(fs.readFileSync(new URL("./firebase.json", import.meta.url), "utf8"));
// Firebase CLI treats the config directory as the project root and rejects ../ rules.
// Keep the demo definition here, but create a temporary root-level config for the CLI.
for (const service of ["firestore", "storage"]) {
  config[service].rules = path.relative(root, fileURLToPath(new URL(config[service].rules, import.meta.url)));
}
const configPath = path.join(root, `.tracking-sa-emulator-${process.pid}.json`);
fs.writeFileSync(configPath, JSON.stringify(config), { flag: "wx" });
try {
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL("./node_modules/firebase-tools/lib/bin/firebase.js", import.meta.url)),
    "emulators:exec", "--config", configPath,
    "--only", browserMode ? "auth,firestore,storage" : "firestore,storage", "--project", "demo-trackingsa-ownership",
    browserMode
      ? `node node_modules/@playwright/test/cli.js test --config tests/e2e/playwright.${coachingMode ? 'coaching' : 'auth'}.config.js`
      : "node --test --test-concurrency=1 tests/emulator/*.test.mjs",
  ], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  fs.unlinkSync(configPath);
}
