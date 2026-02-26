import { execSync } from "node:child_process";

function resolveChromiumPath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) {
    return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  }
  try {
    const path = execSync("command -v chromium || command -v chromium-browser", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return path || undefined;
  } catch {
    return undefined;
  }
}

const chromiumPath = resolveChromiumPath();

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  retries: 1,
  use: {
    baseURL: process.env.TRACKING_SA_BASE_URL || "https://trackingsa.com",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    headless: true,
    launchOptions: chromiumPath
      ? {
          executablePath: chromiumPath,
        }
      : undefined,
  },
  reporter: [["list"]],
};

export default config;
