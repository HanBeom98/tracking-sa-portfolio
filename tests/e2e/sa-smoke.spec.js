import { test, expect } from "@playwright/test";

test("sudden attack public home loads core search UI", async ({ page, baseURL }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  await page.goto(`${baseURL}/stats/sudden-attack/`, { waitUntil: "domcontentloaded" });

  await expect(page.locator("h1")).toContainText("서든어택 전적 검색", { timeout: 15000 });
  await expect(page.locator("#characterName")).toBeVisible();
  await expect(page.locator("#searchBtn")).toBeVisible();
  await expect(page.locator("#resultsShell")).toBeHidden();

  const summaryDefined = await page.evaluate(() => Boolean(window.customElements.get("sa-stats-summary")));
  const playerCardDefined = await page.evaluate(() => Boolean(window.customElements.get("sa-player-card")));
  expect(summaryDefined).toBe(true);
  expect(playerCardDefined).toBe(true);
  expect(pageErrors).toEqual([]);
});

test("sudden attack league hub loads league controls", async ({ page, baseURL }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));

  await page.goto(`${baseURL}/stats/sudden-attack/league/`, { waitUntil: "domcontentloaded" });

  await expect(page.locator("h1")).toContainText("서든어택 리그 허브", { timeout: 15000 });
  await expect(page.locator("#characterName")).toBeVisible();
  await expect(page.locator("#searchBtn")).toBeVisible();
  await expect(page.locator("#applyCrewBtn")).toBeVisible();
  await expect(page.locator("#crewRanking")).toBeVisible();

  const summaryDefined = await page.evaluate(() => Boolean(window.customElements.get("sa-stats-summary")));
  const playerCardDefined = await page.evaluate(() => Boolean(window.customElements.get("sa-player-card")));
  expect(summaryDefined).toBe(true);
  expect(playerCardDefined).toBe(true);
  expect(pageErrors).toEqual([]);
});
