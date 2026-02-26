import { test, expect } from "@playwright/test";

test("news index page renders news grid", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/news/`, { waitUntil: "domcontentloaded" });
  // Wait for the news grid to be hydrated
  await page.waitForSelector(".news-grid");
  const cards = page.locator(".news-card-premium");
  await expect(cards.first()).toBeVisible();
  
  const title = await cards.first().locator(".news-title-text").textContent();
  expect(title?.length).toBeGreaterThan(0);
});

test("news article page renders content", async ({ page, baseURL }) => {
  // Go to news index first to find a valid article link
  await page.goto(`${baseURL}/news/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".news-grid");
  const firstArticleLink = page.locator(".news-card-premium").first();
  const href = await firstArticleLink.getAttribute("href");
  
  // Navigate to the article
  await page.goto(`${baseURL}${href}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".news-article-card");
  
  await expect(page.locator(".news-article-title")).toBeVisible();
  await expect(page.locator(".news-article-content")).toBeVisible();
  await expect(page.locator(".back-list-btn")).toBeVisible();
});

test("ai-test page loads and question advances", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/ai-test/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const host = document.querySelector("ai-test-premium");
    return !!host && !!host.shadowRoot && !!host.shadowRoot.querySelector(".opt-btn");
  });

  const question = page.locator(".q-text");
  const firstQuestion = (await question.textContent()) || "";

  const firstOption = page.locator(".opt-btn").first();
  await expect(firstOption).toBeAttached();
  await firstOption.click();

  await expect(question).not.toHaveText(firstQuestion);
});

test("fortune page renders input controls for guest", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/fortune/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const host = document.querySelector("fortune-premium");
    if (!host || !host.shadowRoot) return false;
    return !!host.shadowRoot.querySelector("#predict-btn");
  });

  await expect(page.locator("#user-name")).toBeAttached();
  await expect(page.locator("#birth-year")).toBeAttached();
  await expect(page.locator("#birth-month")).toBeAttached();
  await expect(page.locator("#birth-day")).toBeAttached();
  await expect(page.locator("#predict-btn")).toBeAttached();
});

test("lucky recommendation page renders input controls for guest", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/lucky-recommendation/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const host = document.querySelector("lucky-recommendation");
    if (!host || !host.shadowRoot) return false;
    return !!host.shadowRoot.querySelector("#predict-btn");
  });

  await expect(page.locator("#user-name")).toBeAttached();
  await expect(page.locator("#birth-month")).toBeAttached();
  await expect(page.locator("#birth-day")).toBeAttached();
  await expect(page.locator("#predict-btn")).toBeAttached();
});
