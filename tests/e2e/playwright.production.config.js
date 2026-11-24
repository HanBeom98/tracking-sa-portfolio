import base from "./playwright.base.config.js";

// Opt-in read-only browser smoke against the explicitly selected deployed site.
export default {
  ...base,
  testMatch: ["auth-smoke.spec.js", "sa-smoke.spec.js"],
  use: { ...base.use, baseURL: process.env.TRACKING_SA_BASE_URL || "https://trackingsa.com" },
};
