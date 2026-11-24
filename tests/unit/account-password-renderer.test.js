import assert from "node:assert/strict";
import test from "node:test";

import { renderAccountView } from "../../src/domains/account/ui/account-renderer.js";

function renderForProviders(providerIds) {
  const previousWindow = globalThis.window;
  const previousLocalStorage = globalThis.localStorage;
  globalThis.window = {};
  globalThis.localStorage = { getItem: () => "ko" };

  const infoEl = { innerHTML: "" };
  const actionsEl = { innerHTML: "" };
  try {
    renderAccountView(
      infoEl,
      actionsEl,
      { uid: "user-1", email: "user@example.com", metadata: {} },
      {
        isAdmin: false,
        providerIds,
        nickname: "",
        subscriptionStatus: "free",
        subscriptionPlan: "",
        subscriptionRenewAt: null,
        subscriptionExpiresAt: null,
      },
      {
        formatProvider: () => "email",
        formatSubscription: () => "free",
        formatDate: () => "-",
        translate: (_, fallback) => fallback,
      }
    );
    return infoEl.innerHTML;
  } finally {
    if (typeof previousWindow === "undefined") delete globalThis.window;
    else globalThis.window = previousWindow;
    if (typeof previousLocalStorage === "undefined") delete globalThis.localStorage;
    else globalThis.localStorage = previousLocalStorage;
  }
}

test("account view shows password controls only for email/password users", () => {
  const passwordHtml = renderForProviders(["password"]);
  const providerHtml = renderForProviders(["google.com"]);

  assert.match(passwordHtml, /id="current-password"/);
  assert.match(passwordHtml, /id="new-password"/);
  assert.match(passwordHtml, /id="new-password-confirm"/);
  assert.match(passwordHtml, /id="password-change-open"/);
  assert.match(passwordHtml, /id="password-change-modal"/);
  assert.match(passwordHtml, /role="dialog"/);
  assert.match(passwordHtml, /id="password-change"/);
  assert.doesNotMatch(providerHtml, /id="password-change-open"/);
});
