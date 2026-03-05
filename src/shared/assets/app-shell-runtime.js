(function (globalScope) {
  function createAppShellRuntime() {
    const root = globalScope || globalThis;
    let currentLang = root.localStorage.getItem("lang") || "ko";
    const initialPath = root.location.pathname || "/";
    if (initialPath.startsWith("/en/")) {
      currentLang = "en";
    }
    root.localStorage.setItem("lang", currentLang);
    root.document.documentElement.setAttribute("lang", currentLang === "en" ? "en" : "ko");

    // --- Translation Merging (Domain DDD Support) ---
    if (root.translations && root.domainTranslations) {
      Object.keys(root.domainTranslations).forEach(lang => {
        if (root.translations[lang]) {
          Object.assign(root.translations[lang], root.domainTranslations[lang]);
        } else {
          root.translations[lang] = root.domainTranslations[lang];
        }
      });
    }

    function getTranslation(key, defaultValue = "") {
      const dict = (root.translations && root.translations[currentLang]) || null;
      if (dict && dict[key]) return dict[key];
      return defaultValue || key;
    }

    function applyTranslations() {
      const path = root.location.pathname || "/";
      const isEnglishPath = path.startsWith("/en/");

      root.document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        const translated = getTranslation(key);
        
        // Skip if the text is already translated statically (for English pages)
        if (isEnglishPath && el.innerText.trim() === translated.replace(/<[^>]*>/g, '').trim()) {
          return;
        }

        if (translated !== key) {
          el.innerHTML = translated;
        }
      });
    }

    function setLanguage(lang) {
      root.localStorage.setItem("lang", lang);
      currentLang = lang;
      root.document.documentElement.setAttribute("lang", lang === "en" ? "en" : "ko");
      const path = root.location.pathname || "/";
      const isEnglishPath = path.startsWith("/en/");

      if (lang === "en") {
        if (isEnglishPath) return root.location.reload();
        // Redirect to /en/ path for all pages
        return (root.location.href = "/en" + path);
      }

      if (lang === "ko" && isEnglishPath) {
        // Remove /en/ prefix for all pages
        return (root.location.href = path.replace(/^\/en\//, "/"));
      }

      root.location.reload();
    }

    function initTheme() {
      const body = root.document.body;
      const themeBtn = root.document.getElementById("color-change");
      const savedTheme = root.localStorage.getItem("theme") || "light";

      if (savedTheme === "dark") {
        body.classList.add("dark-mode");
        if (themeBtn) themeBtn.innerText = "🌙";
      } else {
        body.classList.remove("dark-mode");
        if (themeBtn) themeBtn.innerText = "☀️";
      }

      if (themeBtn) {
        themeBtn.onclick = () => {
          const isDark = body.classList.toggle("dark-mode");
          root.localStorage.setItem("theme", isDark ? "dark" : "light");
          themeBtn.innerText = isDark ? "🌙" : "☀️";
        };
      }
    }

    function initLanguageSwitcher() {
      const container = root.document.getElementById("language-switcher");
      if (!container) return;
      container.innerHTML = `
        <button class="lang-button ${currentLang === "ko" ? "active" : ""}" onclick="setLanguage('ko')">KOR</button>
        <button class="lang-button ${currentLang === "en" ? "active" : ""}" onclick="setLanguage('en')">ENG</button>
      `;
    }

    function updateGnbLinksForLang() {
      const isEnglish = currentLang === "en";
      const gnbLinks = root.document.querySelectorAll("header nav a, footer a");
      gnbLinks.forEach((link) => {
        const href = link.getAttribute("href");
        if (!href || href === "#" || href.startsWith("http")) return;
        
        let newHref = href;
        if (isEnglish) {
          if (!href.startsWith("/en/") && href.startsWith("/")) {
            newHref = "/en" + href;
          }
        } else {
          if (href.startsWith("/en/")) {
            newHref = href.replace(/^\/en\//, "/");
          }
        }
        
        if (newHref !== href) {
          link.setAttribute("href", newHref.replace("//", "/"));
        }
      });
    }

    function initDropdownMenus() {
      const dropdowns = Array.from(root.document.querySelectorAll("header .dropdown"));
      if (!dropdowns.length) return;

      const closeAll = () => dropdowns.forEach((d) => d.classList.remove("open"));

      dropdowns.forEach((dropdown) => {
        const btn = dropdown.querySelector(".dropbtn");
        const menu = dropdown.querySelector(".dropdown-content");
        let closeTimer = null;

        const open = () => {
          if (closeTimer) clearTimeout(closeTimer);
          dropdowns.forEach((d) => {
            if (d !== dropdown) d.classList.remove("open");
          });
          dropdown.classList.add("open");
        };

        const scheduleClose = (event) => {
          if (event && event.relatedTarget && dropdown.contains(event.relatedTarget)) return;
          if (closeTimer) clearTimeout(closeTimer);
          closeTimer = setTimeout(() => {
            dropdown.classList.remove("open");
          }, 420);
        };

        dropdown.addEventListener("mouseenter", open);
        dropdown.addEventListener("mouseleave", scheduleClose);
        dropdown.addEventListener("focusin", open);
        dropdown.addEventListener("focusout", (event) => {
          if (!dropdown.contains(event.relatedTarget)) scheduleClose();
        });

        if (btn) {
          btn.addEventListener("click", (event) => {
            event.preventDefault();
            const wasOpen = dropdown.classList.contains("open");
            closeAll();
            if (!wasOpen) dropdown.classList.add("open");
          });
        }

        if (menu) {
          menu.addEventListener("mouseenter", open);
          menu.addEventListener("mouseleave", scheduleClose);
        }
      });

      root.document.addEventListener("click", (event) => {
        if (!event.target.closest("header .dropdown")) {
          closeAll();
        }
      });
    }

    function ensureShellVisibility() {
      // Redundant with static HTML injection. 
      // Handled by CSS for smooth loading.
    }

    function initShell() {
      applyTranslations();
      initTheme();
      initLanguageSwitcher();
      updateGnbLinksForLang();
      initDropdownMenus();
      ensureShellVisibility();
    }

    root.getTranslation = getTranslation;
    root.applyTranslations = () => applyTranslations();
    root.setLanguage = setLanguage;

    return {
      initShell,
      ensureShellVisibility,
      getCurrentLang: () => currentLang,
    };
  }

  if (globalScope && typeof globalScope === "object") {
    globalScope.createAppShellRuntime = createAppShellRuntime;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
