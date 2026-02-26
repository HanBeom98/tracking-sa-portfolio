import { test, expect } from "@playwright/test";

test("news index page renders news grid", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/news/`, { waitUntil: "networkidle" });
  // Wait for the news grid to be hydrated
  await page.waitForSelector(".news-grid", { timeout: 15000 });
  const cards = page.locator(".news-card-premium");
  await expect(cards.first()).toBeVisible();
  
  const title = await cards.first().locator(".news-title-text").textContent();
  expect(title?.length).toBeGreaterThan(0);
});

test("news article page renders content", async ({ page, baseURL }) => {
  // Go to news index first to find a valid article link
  await page.goto(`${baseURL}/news/`, { waitUntil: "networkidle" });
  await page.waitForSelector(".news-grid");
  const firstArticleLink = page.locator(".news-card-premium").first();
  const href = await firstArticleLink.getAttribute("href");
  
  // Navigate to the article
  await page.goto(`${baseURL}${href}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".news-article-card");
  
  await expect(page.locator(".news-article-title")).toBeVisible();
  await expect(page.locator(".news-article-content")).toBeVisible();
  await expect(page.locator(".back-list-btn")).toBeVisible();
});

test("ai-test page loads and question advances", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/ai-test/`, { waitUntil: "networkidle" });
  
  // Playwright's locator handles shadow DOM automatically with the >> selector or standard locators
  const aiTestHost = page.locator("ai-test-premium");
  await expect(aiTestHost).toBeVisible();
  
  const firstOption = aiTestHost.locator(".opt-btn").first();
  await expect(firstOption).toBeVisible({ timeout: 15000 });

  const question = aiTestHost.locator(".q-text");
  const firstQuestion = (await question.textContent()) || "";

  await firstOption.click();
  await expect(question).not.toHaveText(firstQuestion);
});

test("fortune page renders input controls for guest", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/fortune/`, { waitUntil: "networkidle" });
  
  const fortuneHost = page.locator("fortune-premium");
  await expect(fortuneHost).toBeVisible();
  
  // Wait for shadow root content
  const predictBtn = fortuneHost.locator("#predict-btn");
  await expect(predictBtn).toBeVisible({ timeout: 15000 });

  await expect(fortuneHost.locator("#user-name")).toBeAttached();
  await expect(fortuneHost.locator("#birth-year")).toBeAttached();
  await expect(fortuneHost.locator("#birth-month")).toBeAttached();
  await expect(fortuneHost.locator("#birth-day")).toBeAttached();
});

test("lucky recommendation page renders input controls for guest", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/lucky-recommendation/`, { waitUntil: "networkidle" });
  
  const luckyHost = page.locator("lucky-recommendation");
  await expect(luckyHost).toBeVisible();
  
  const predictBtn = luckyHost.locator("#predict-btn");
  await expect(predictBtn).toBeVisible({ timeout: 15000 });

  await expect(luckyHost.locator("#user-name")).toBeAttached();
  await expect(luckyHost.locator("#birth-month")).toBeAttached();
  await expect(luckyHost.locator("#birth-day")).toBeAttached();
});
