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
  await page.goto(`${baseURL}/account/`, { waitUntil: "networkidle" });
  const loginBtn = page.locator("#account-login-btn");
  await expect(loginBtn).toBeVisible({ timeout: 15000 });

  await loginBtn.click();
  await expectInlineLoginModalOpen(page);
});

test("board list page loads and renders posts", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/board/`, { waitUntil: "networkidle" });
  const boardList = page.locator("board-list");
  await expect(boardList).toBeVisible({ timeout: 15000 });
  
  // Wait for the component to fetch data and set status to ready
  await expect(boardList).toHaveAttribute("status", "ready", { timeout: 20000 });
});

test("board write guest state blocks form and can open login modal", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/board/write/`, { waitUntil: "networkidle" });
  const loginBtn = page.locator("#board-write-login-btn");
  await expect(loginBtn).toBeVisible({ timeout: 15000 });

  await expect(page.locator("board-write-form")).toBeHidden();

  await loginBtn.click();
  await expectInlineLoginModalOpen(page);
});
