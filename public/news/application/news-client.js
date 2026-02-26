import { resolveNewsLocale } from "./news-routing.js";
import { hydrateNewsIndex } from "./news-index-page.js";
import { hydrateEnglishNewsArticle } from "./news-article-page.js";
import { mountAdminDeleteButton } from "./news-admin-actions.js";

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.db) return;

  const path = window.location.pathname || "/";
  const storedLang = localStorage.getItem("lang") || "ko";
  const { isEn, isEnPath } = resolveNewsLocale({ path, storedLang });

  const grid = document.querySelector(".news-grid");
  if (grid) {
    try {
      await hydrateNewsIndex({ db: window.db, grid, isEn });
    } catch (err) {
      console.error("News index fetch failed:", err);
    }
  }

  const articleTitle = document.querySelector(".news-article-title");
  const articleContent = document.querySelector(".news-article-content");
  if (articleTitle && articleContent) {
    try {
      await hydrateEnglishNewsArticle({ db: window.db, path, isEn, articleTitle, articleContent });
    } catch (err) {
      console.error("News article fetch failed:", err);
    }
  }

  await mountAdminDeleteButton({ path, isEnPath });
});
