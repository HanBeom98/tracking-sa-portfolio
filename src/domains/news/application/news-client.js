import { resolveNewsLocale } from "./news-routing.js";
import { hydrateNewsIndex } from "./news-index-page.js";
import { hydrateEnglishNewsArticle } from "./news-article-page.js";
import { mountAdminDeleteButton } from "../ui/news-admin-actions.js";
import { setupPagination } from "./news-pagination.js";

function getWindowObject() {
  const win = globalThis["window"];
  if (win && typeof win === "object") return win;
  return globalThis;
}

function getDocumentObject() {
  const doc = globalThis["document"];
  return doc && typeof doc === "object" ? doc : null;
}

async function initNewsClient() {
  const win = getWindowObject();
  const doc = getDocumentObject();
  if (!doc || !win?.db) return;

  // Re-apply translations to ensure hero title and static elements are translated
  if (typeof win.applyTranslations === "function") {
    win.applyTranslations();
  }

  const path = win.location?.pathname || "/";
  const storedLang = win.localStorage?.getItem("lang") || "ko";
  const { isEn, isEnPath } = resolveNewsLocale({ path, storedLang });

  const grid = doc.querySelector(".news-grid");
  if (grid) {
    try {
      // Always hydrate in English mode to replace static Korean content,
      // or if the grid is completely empty.
      if (isEn || !grid.children.length) {
        await hydrateNewsIndex({ db: win.db, grid, isEn });
      }

      // Initialize pagination for either static or hydrated content
      setupPagination({
        grid,
        pagination: doc.getElementById("news-pagination"),
        prevBtn: doc.getElementById("prev-page"),
        nextBtn: doc.getElementById("next-page"),
        indicator: doc.getElementById("page-indicator"),
      });
    } catch (err) {
      console.error("News index setup failed:", err);
    }
  }

  const articleTitle = doc.querySelector(".news-article-title");
  const articleContent = doc.querySelector(".news-article-content");
  if (articleTitle && articleContent) {
    try {
      await hydrateEnglishNewsArticle({ db: win.db, path, isEn, articleTitle, articleContent });
    } catch (err) {
      console.error("News article fetch failed:", err);
    }
  }

  await mountAdminDeleteButton({ path, isEnPath });
}

const doc = getDocumentObject();
if (doc?.readyState === "loading") {
  doc.addEventListener("DOMContentLoaded", initNewsClient);
} else {
  initNewsClient();
}
