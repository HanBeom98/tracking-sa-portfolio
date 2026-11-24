import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Firebase App Check loads before Firebase services and activates only with a configured key", () => {
  const head = readFileSync("src/shared/ui/head.html", "utf8");
  const config = readFileSync("src/shared/assets/firebase-config.js", "utf8");
  const template = readFileSync("src/shared/infra/templates.py", "utf8");

  assert.ok(head.indexOf("firebase-app-check.js") > head.indexOf("firebase-app.js"));
  assert.ok(head.indexOf("firebase-app-check.js") < head.indexOf("firebase-firestore.js"));
  assert.ok(config.includes("runtimeConfig.appCheckSiteKey && firebase.appCheck"));
  assert.ok(config.includes("new firebase.appCheck.ReCaptchaEnterpriseProvider(runtimeConfig.appCheckSiteKey)"));
  assert.ok(config.includes("firebase.appCheck().activate(appCheckProvider, true)"));
  assert.ok(template.includes('VITE_FIREBASE_APP_CHECK_SITE_KEY'));
});
