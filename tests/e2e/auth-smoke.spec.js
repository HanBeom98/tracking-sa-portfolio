import { test, expect } from "@playwright/test";

async function expectInlineLoginModalOpen(page) {
  const modal = page.locator("#global-inline-login-modal");
  await expect(modal).toHaveClass(/open/);
  await expect(page.locator("#inline-login-email")).toBeVisible();
  await expect(page.locator("#inline-login-password")).toBeVisible();
}

test("account guest login button opens inline login modal", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/account/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#account-login-btn");

  await page.locator("#account-login-btn").click();
  await expectInlineLoginModalOpen(page);
});

test("board write guest state blocks form and can open login modal", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/board/write/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#board-write-login-btn");

  await expect(page.locator("board-write-form")).toBeHidden();

  await page.locator("#board-write-login-btn").click();
  await expectInlineLoginModalOpen(page);
});
