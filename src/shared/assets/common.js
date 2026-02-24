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
    if (window.translations && translations[currentLang] && translations[currentLang][key]) {
        return translations[currentLang][key];
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

document.addEventListener('DOMContentLoaded', () => {
    window.applyTranslations(currentLang);
    initTheme();
    initLanguageSwitcher();
    
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
