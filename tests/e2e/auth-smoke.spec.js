import { test, expect } from "@playwright/test";

async function expectInlineLoginModalOpen(page) {
  // Use a longer timeout for the modal to appear and be visible
  const modal = page.locator("#global-inline-login-modal");
  await expect(modal).toBeVisible({ timeout: 15000 });
  await expect(modal).toHaveClass(/open/);
  await expect(page.locator("#inline-login-email")).toBeVisible();
  await expect(page.locator("#inline-login-password")).toBeVisible();
}

test("account guest login button opens inline login modal", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/account/`, { waitUntil: "domcontentloaded" });
  const loginBtn = page.locator("#account-login-btn");
  await expect(loginBtn).toBeVisible({ timeout: 15000 });

  await loginBtn.click();
  await expectInlineLoginModalOpen(page);
});

test("dragging a saved email selection outside does not close the login modal", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/account/`, { waitUntil: "domcontentloaded" });
  await page.locator("#account-login-btn").click();
  await expectInlineLoginModalOpen(page);

  const email = page.locator("#inline-login-email");
  await email.fill("saved@example.com");
  const inputBox = await email.boundingBox();
  const dialogBox = await page.locator(".inline-login-dialog").boundingBox();

  if (!inputBox || !dialogBox) {
    throw new Error("Login modal geometry was not available");
  }

  await page.mouse.move(inputBox.x + inputBox.width - 10, inputBox.y + inputBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dialogBox.x - 40, inputBox.y + inputBox.height / 2, { steps: 5 });
  await page.mouse.up();

  await expectInlineLoginModalOpen(page);
});

test("pressing Enter in the login password field submits email login", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/account/`, { waitUntil: "domcontentloaded" });
  await page.locator("#account-login-btn").click();
  await expectInlineLoginModalOpen(page);

  await page.locator("#inline-login-email").fill("");
  await page.locator("#inline-login-password").fill("password");
  await page.locator("#inline-login-password").press("Enter");

  await expect(page.locator("#inline-login-error")).not.toHaveText("");
});

test("home starts the auth runtime automatically to restore saved sessions", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: "domcontentloaded" });

  await expect(page.locator('script[src*="firebase-app.js"]')).toHaveCount(1, { timeout: 15000 });
  const loginBtn = page.locator("#auth-login");
  await expect(loginBtn).toBeVisible({ timeout: 15000 });

  await loginBtn.click();
  await expect(page.locator("#auth-controls")).toHaveClass(/open/);
  await expect(page.locator('script[src*="firebase-app.js"]')).toHaveCount(1);
});

test("dragging from the header email field outside does not close the login menu", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.openAuthPrompt === "function");
  await page.evaluate(() => window.openAuthPrompt());

  const controls = page.locator("#auth-controls");
  const email = page.locator("#auth-email");
  await expect(controls).toHaveClass(/open/);
  await email.fill("saved@example.com");

  const inputBox = await email.boundingBox();
  if (!inputBox) throw new Error("Header login email geometry was not available");

  await page.mouse.move(inputBox.x + inputBox.width - 10, inputBox.y + inputBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(inputBox.x - 220, inputBox.y + inputBox.height / 2, { steps: 5 });
  await page.mouse.up();

  await expect(controls).toHaveClass(/open/);
});

test("board list page loads and renders posts", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/board/`, { waitUntil: "domcontentloaded" });
  const boardList = page.locator("board-list");
  await expect(boardList).toBeVisible({ timeout: 15000 });
  
  // Wait for the component to fetch data and set status to ready
  await expect(boardList).toHaveAttribute("status", "ready", { timeout: 20000 });
});

test("board write guest state blocks form and can open login modal", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/board/write/`, { waitUntil: "domcontentloaded" });
  const loginBtn = page.locator("#board-write-login-btn");
  await expect(loginBtn).toBeVisible({ timeout: 15000 });

  await expect(page.locator("board-write-form")).toBeHidden();

  await loginBtn.click();
  await expectInlineLoginModalOpen(page);
});
