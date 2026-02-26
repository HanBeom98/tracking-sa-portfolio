/**
 * Tracking SA Core Logic (Total Reset v1.0)
 * Handles: i18n, Theme Toggle, Layout Stability
 */

let currentLang = localStorage.getItem('lang') || 'ko';
const initialPath = window.location.pathname || "/";
if (initialPath.startsWith('/en/')) {
    currentLang = 'en';
}
localStorage.setItem('lang', currentLang);
document.documentElement.setAttribute('lang', currentLang === 'en' ? 'en' : 'ko');

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
    currentLang = lang;
    document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'ko');
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

function initDropdownMenus() {
    const dropdowns = Array.from(document.querySelectorAll('header .dropdown'));
    if (!dropdowns.length) return;

    const closeAll = () => dropdowns.forEach(d => d.classList.remove('open'));

    dropdowns.forEach((dropdown) => {
        const btn = dropdown.querySelector('.dropbtn');
        const menu = dropdown.querySelector('.dropdown-content');
        let closeTimer = null;

        const open = () => {
            if (closeTimer) clearTimeout(closeTimer);
            dropdowns.forEach((d) => {
                if (d !== dropdown) d.classList.remove('open');
            });
            dropdown.classList.add('open');
        };

        const scheduleClose = (event) => {
            if (event && event.relatedTarget && dropdown.contains(event.relatedTarget)) {
                return;
            }
            if (closeTimer) clearTimeout(closeTimer);
            closeTimer = setTimeout(() => {
                dropdown.classList.remove('open');
            }, 420);
        };

        dropdown.addEventListener('mouseenter', open);
        dropdown.addEventListener('mouseleave', scheduleClose);
        dropdown.addEventListener('focusin', open);
        dropdown.addEventListener('focusout', (e) => {
            if (!dropdown.contains(e.relatedTarget)) scheduleClose();
        });

        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const wasOpen = dropdown.classList.contains('open');
                closeAll();
                if (!wasOpen) dropdown.classList.add('open');
            });
        }

        if (menu) {
            menu.addEventListener('mouseenter', open);
            menu.addEventListener('mouseleave', scheduleClose);
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('header .dropdown')) {
            closeAll();
        }
    });
}

let authUser = null;
let authProfile = null;
let authReadyResolve = null;
let authUiController = null;
let inlineModalController = null;
let authStateBus = null;
window.authStateReady = new Promise((resolve) => {
    authReadyResolve = resolve;
});

function resolveAuthReady(user) {
    if (authReadyResolve) {
        authReadyResolve(user);
        authReadyResolve = null;
    }
}

function createFallbackAuthStateBus() {
    const listeners = new Set();
    return {
        subscribe(listener) {
            if (typeof listener !== "function") return () => {};
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        publish(state = {}) {
            listeners.forEach((listener) => {
                try {
                    listener(state);
                } catch (error) {
                    console.error("AuthStateBus listener failed:", error);
                }
            });
        },
        getSnapshot() {
            return { user: authUser, profile: authProfile };
        },
    };
}

async function loadAuthStateBusFactory() {
    if (typeof window.createAuthStateBus === "function") {
        return window.createAuthStateBus;
    }
    await new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-auth-state-bus="true"]');
        if (existing) {
            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener("error", reject, { once: true });
            return;
        }
        const script = document.createElement("script");
        script.src = "/auth-state-bus.js";
        script.async = true;
        script.dataset.authStateBus = "true";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
    return window.createAuthStateBus;
}

async function ensureAuthStateBus() {
    if (authStateBus) return authStateBus;
    try {
        const factory = await loadAuthStateBusFactory();
        if (typeof factory === "function") {
            authStateBus = factory({
                onListenerError(error) {
                    console.error("AuthStateBus listener failed:", error);
                },
            });
        }
    } catch (error) {
        console.error("AuthStateBus factory load failed:", error);
    }
    if (!authStateBus) {
        authStateBus = createFallbackAuthStateBus();
    }
    return authStateBus;
}

function publishAuthStateChange(user, profile) {
    if (authStateBus && typeof authStateBus.publish === "function") {
        authStateBus.publish({ user, profile });
    }
    window.dispatchEvent(new CustomEvent("auth-state-changed", {
        detail: { user, profile }
    }));
}

window.AuthStateBus = {
    subscribe(listener) {
        if (!authStateBus || typeof authStateBus.subscribe !== "function") return () => {};
        return authStateBus.subscribe(listener);
    },
    getSnapshot() {
        if (!authStateBus || typeof authStateBus.getSnapshot !== "function") {
            return { user: authUser, profile: authProfile };
        }
        return authStateBus.getSnapshot();
    },
};

async function getAuthService() {
    if (window.AuthService) return window.AuthService;
    if (window.authDomainReady) {
        const service = await window.authDomainReady;
        if (service) return service;
    }
    return null;
}

async function loadInlineLoginModalFactory() {
    if (typeof window.createInlineLoginModalController === "function") {
        return window.createInlineLoginModalController;
    }
    await new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-inline-login-modal="true"]');
        if (existing) {
            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener("error", reject, { once: true });
            return;
        }
        const script = document.createElement("script");
        script.src = "/inline-login-modal.js";
        script.async = true;
        script.dataset.inlineLoginModal = "true";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
    return window.createInlineLoginModalController;
}

async function loadAuthUiControllerFactory() {
    if (typeof window.createAuthUiController === "function") {
        return window.createAuthUiController;
    }
    await new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-auth-ui-controller="true"]');
        if (existing) {
            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener("error", reject, { once: true });
            return;
        }
        const script = document.createElement("script");
        script.src = "/auth-ui-controller.js";
        script.async = true;
        script.dataset.authUiController = "true";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
    return window.createAuthUiController;
}

async function ensureInlineLoginModalController() {
    if (inlineModalController) return inlineModalController;
    const factory = await loadInlineLoginModalFactory();
    if (typeof factory !== "function") {
        throw new Error("Inline login modal factory is not available.");
    }
    inlineModalController = factory({ getAuthService });
    return inlineModalController;
}

async function ensureAuthUiController() {
    if (authUiController) return authUiController;
    const factory = await loadAuthUiControllerFactory();
    if (typeof factory !== "function") {
        throw new Error("Auth UI controller factory is not available.");
    }
    authUiController = factory({
        getAuthService,
        getCurrentUser: () => authUser,
        onLogoutSuccess: () => {
            const path = window.location.pathname || "/";
            const isAccountPage = path === "/account/" || path === "/account" || path === "/account/index.html";
            if (isAccountPage) {
                window.location.href = "/account/";
            }
        },
    });
    return authUiController;
}

async function initAuthControls() {
    try {
        const controller = await ensureAuthUiController();
        await controller.init();
    } catch (error) {
        console.error("Auth UI controller init failed:", error);
    }
}

window.showAuthMenu = () => {
    if (!authUiController) {
        alert(window.getTranslation("auth_required", "로그인이 필요합니다."));
        return;
    }
    authUiController.showAuthMenu();
};

window.openAuthPrompt = () => {
    if (!authUiController) {
        alert(window.getTranslation("auth_required", "로그인이 필요합니다."));
        return;
    }
    authUiController.openAuthPrompt();
};

window.updateAuthControls = (user) => {
    if (!authUiController) return;
    authUiController.updateUser(user, authProfile);
};

window.openInlineLoginModal = async ({ redirectTo = "/" } = {}) => {
    try {
        const controller = await ensureInlineLoginModalController();
        await controller.open({ redirectTo });
    } catch (error) {
        console.error("Inline login modal open failed:", error);
        alert(window.getTranslation("auth_ui_load_failed", "로그인 기능을 불러오지 못했습니다. 잠시 후 다시 시도해주세요."));
    }
};

window.promptLogin = ({ redirectTo = "/" } = {}) => {
    if (window.openInlineLoginModal) {
        window.openInlineLoginModal({ redirectTo });
        return;
    }
    if (window.openAuthPrompt) {
        window.openAuthPrompt();
    }
};

window.createLoginRequiredPrompt = ({
    promptId = "",
    wrapperClass = "",
    messageKey = "auth_required",
    messageText = "로그인이 필요합니다.",
    buttonId = "",
    redirectTo = "/",
} = {}) => {
    const wrapper = document.createElement("div");
    if (promptId) wrapper.id = promptId;
    if (wrapperClass) wrapper.className = wrapperClass;

    const messageEl = document.createElement("p");
    if (messageKey) messageEl.setAttribute("data-i18n", messageKey);
    const translate = window.getTranslation || ((_, fallback) => fallback);
    messageEl.textContent = messageKey ? translate(messageKey, messageText) : messageText;

    const loginBtn = document.createElement("button");
    loginBtn.type = "button";
    loginBtn.className = "auth-button primary";
    if (buttonId) loginBtn.id = buttonId;
    loginBtn.setAttribute("data-i18n", "login");
    loginBtn.textContent = translate("login", "로그인");
    loginBtn.addEventListener("click", () => {
        if (window.promptLogin) window.promptLogin({ redirectTo });
    });

    wrapper.appendChild(messageEl);
    wrapper.appendChild(loginBtn);
    return wrapper;
};

function initAuthGateLinks() {
    const links = document.querySelectorAll('a[data-require-auth="true"]');
    if (!links.length) return;

    links.forEach((link) => {
        link.addEventListener('click', async (event) => {
            if (!window.authStateReady) return;
            const user = await window.authStateReady;
            if (user) return;
            event.preventDefault();
            sessionStorage.setItem("postLoginRedirect", link.getAttribute("href") || "/");
            if (window.showAuthMenu) window.showAuthMenu();
        });
    });
}

async function initAuth() {
    const authService = await getAuthService();
    if (!authService) {
        resolveAuthReady(null);
        publishAuthStateChange(null, null);
        if (window.updateAuthControls) window.updateAuthControls(null);
        return;
    }

    authService.onAuthStateChanged(({ user, profile }) => {
        authUser = user || null;
        authProfile = profile || null;
        resolveAuthReady(authUser);
        publishAuthStateChange(authUser, authProfile);
        if (window.updateAuthControls) window.updateAuthControls(authUser);
        if (authUser) {
            const redirectTo = sessionStorage.getItem("postLoginRedirect");
            if (redirectTo) {
                sessionStorage.removeItem("postLoginRedirect");
                window.location.href = redirectTo;
            }
        }
    });
}

window.getCurrentUser = () => authUser;
window.getCurrentUserProfile = () => authProfile;
window.requireAuth = async ({ redirectTo } = {}) => {
    if (!window.authStateReady) return null;
    const user = await window.authStateReady;
    if (user) return user;
    sessionStorage.setItem("postLoginRedirect", redirectTo || window.location.pathname + window.location.search);
    if (window.showAuthMenu) window.showAuthMenu();
    return null;
};

window.AuthGateway = {
    waitForReady: async () => {
        if (!window.authStateReady) return null;
        return window.authStateReady;
    },
    getCurrentUser: () => authUser,
    getCurrentUserProfile: () => authProfile,
    requireAuth: async ({ redirectTo } = {}) => {
        if (!window.authStateReady) return null;
        const user = await window.authStateReady;
        if (user) return user;
        sessionStorage.setItem("postLoginRedirect", redirectTo || window.location.pathname + window.location.search);
        if (window.showAuthMenu) window.showAuthMenu();
        return null;
    },
    getAuthService,
};

document.addEventListener('DOMContentLoaded', async () => {
    window.applyTranslations(currentLang);
    initTheme();
    initLanguageSwitcher();
    updateNewsLinksForLang();
    initDropdownMenus();
    await ensureAuthStateBus();
    await initAuthControls();
    initAuthGateLinks();
    initAuth();
    
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
