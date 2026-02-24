/**
 * Tracking SA Core Logic (Total Reset v1.0)
 * Handles: i18n, Theme Toggle, Layout Stability
 */

let currentLang = localStorage.getItem('lang') || 'ko';

/**
 * Standardized translation utility for all domains.
 * @param {string} key - Translation key
 * @param {string} defaultValue - Fallback text
 * @returns {string} Translated text
 */
window.getTranslation = function(key, defaultValue = "") {
    const dict = (window.translations && window.translations[currentLang]) || null;
    if (dict && dict[key]) {
        return dict[key];
    }
    return defaultValue || key;
};

window.applyTranslations = function(lang) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translated = window.getTranslation(key);
        if (translated !== key) {
            el.innerHTML = translated;
        }
    });
};

window.setLanguage = function(lang) {
    localStorage.setItem('lang', lang);
    const path = window.location.pathname || "/";

    const isNewsIndex = path === "/news" || path === "/news/" || path === "/news/index.html";
    const isNewsArticle = /^\/\d{4}-\d{2}-\d{2}-.+\.html$/.test(path) || /^\/news-\d{10}-\d+\.html$/.test(path);
    const isEnglishPath = path.startsWith("/en/");

    if (lang === "en") {
        if (isEnglishPath) {
            location.reload();
            return;
        }
        if (isNewsIndex) {
            location.href = "/en/news/";
            return;
        }
        if (isNewsArticle) {
            location.href = "/en" + path;
            return;
        }
    }

    if (lang === "ko") {
        if (isEnglishPath) {
            location.href = path.replace(/^\/en\//, "/");
            return;
        }
    }

    location.reload();
};

function initTheme() {
    const body = document.body;
    const themeBtn = document.getElementById('color-change');
    const savedTheme = localStorage.getItem('theme') || 'light';
    
    if (savedTheme === 'dark') {
        body.classList.add('dark-mode');
        if (themeBtn) themeBtn.innerText = '🌙';
    } else {
        body.classList.remove('dark-mode');
        if (themeBtn) themeBtn.innerText = '☀️';
    }

    if (themeBtn) {
        themeBtn.onclick = () => {
            const isDark = body.classList.toggle('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            themeBtn.innerText = isDark ? '🌙' : '☀️';
        };
    }
}

function initLanguageSwitcher() {
    const container = document.getElementById('language-switcher');
    if (container) {
        container.innerHTML = `
            <button class="lang-button ${currentLang==='ko'?'active':''}" onclick="setLanguage('ko')">KOR</button>
            <button class="lang-button ${currentLang==='en'?'active':''}" onclick="setLanguage('en')">ENG</button>
        `;
    }
}

function updateNewsLinksForLang() {
    const links = document.querySelectorAll('a[href="/news/"], a[href="/news"]');
    const target = currentLang === 'en' ? '/en/news/' : '/news/';
    links.forEach(link => link.setAttribute('href', target));
}

document.addEventListener('DOMContentLoaded', () => {
    window.applyTranslations(currentLang);
    initTheme();
    initLanguageSwitcher();
    updateNewsLinksForLang();
    
    // Final Visibility Check & Force Reveal (Overriding CSS !important)
    const header = document.querySelector('header');
    if (header) {
        header.style.setProperty('display', 'flex', 'important');
        header.style.setProperty('visibility', 'visible', 'important');
        
        const nav = header.querySelector('nav');
        if (nav) nav.style.setProperty('display', 'block', 'important');
        
        const logo = header.querySelector('.site-logo-link');
        if (logo) logo.style.setProperty('display', 'block', 'important');
    }

    const footer = document.querySelector('footer');
    if (footer) {
        footer.style.setProperty('display', 'block', 'important');
        footer.style.setProperty('visibility', 'visible', 'important');
    }
});
