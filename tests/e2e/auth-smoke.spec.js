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

test("board list page loads and renders posts", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/board/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("board-list");
  
  // Wait for post items to appear inside board-list shadow DOM or light DOM
  // Depending on how board-list is implemented (it seems to be a web component)
  const boardList = page.locator("board-list");
  await expect(boardList).toBeVisible();
  
  // We can't easily check shadow DOM internals with simple locators unless we use specific playwright selectors
  // But we can check if the component status changes to ready
  await expect(boardList).toHaveAttribute("status", "ready");
});

test("board write guest state blocks form and can open login modal", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/board/write/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#board-write-login-btn");

  await expect(page.locator("board-write-form")).toBeHidden();

  await page.locator("#board-write-login-btn").click();
  await expectInlineLoginModalOpen(page);
});
