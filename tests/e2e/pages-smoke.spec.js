import { test, expect } from "@playwright/test";

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
