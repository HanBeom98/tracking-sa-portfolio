import base from "./playwright.base.config.js";
import { fileURLToPath } from "node:url";

// This suite can only target the fresh local build, including when CI is run manually.
export default {
  ...base,
  testMatch: ["local-smoke.spec.js", "public-match-list.spec.js", "board-theme.spec.js", "replay-fast-start.spec.js", "replay-lazy-loading.spec.js", "replay-print-report.spec.js", "replay-product-example.spec.js", "replay-polishing.spec.js", "home-replay-entry.spec.js", "admin-dashboard.spec.js", "mygun2.spec.js"],
  testIgnore: [],
  retries: 0,
  workers: 1,
  use: { ...base.use, baseURL: "http://127.0.0.1:4173", serviceWorkers: "block" },
  globalSetup: fileURLToPath(new URL("./local-server.mjs", import.meta.url)),
};
