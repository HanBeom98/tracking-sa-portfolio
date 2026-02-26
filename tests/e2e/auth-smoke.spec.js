import { test, expect } from "@playwright/test";

test("account guest login button opens inline login modal", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/account/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.openInlineLoginModal === "function");

  const accountLoginBtn = page.locator("#account-login-btn");
  await expect(accountLoginBtn).toBeVisible();
  await accountLoginBtn.click();

  await expect(page.locator("#global-inline-login-modal")).toHaveClass(/open/);
  await expect(page.locator("#inline-login-email")).toBeVisible();
  await expect(page.locator("#inline-login-password")).toBeVisible();
});

test("board write guest state blocks form and can open login modal", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/board/write`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.openInlineLoginModal === "function");

  await expect(page.locator("text=게시글 작성은 로그인 후 이용할 수 있습니다.")).toBeVisible();
  await expect(page.locator("#board-write-form")).toBeHidden();

  const guestLoginBtn = page.locator("#board-write-login-btn");
  await expect(guestLoginBtn).toBeVisible();
  await guestLoginBtn.click();

  await expect(page.locator("#global-inline-login-modal")).toHaveClass(/open/);
});
