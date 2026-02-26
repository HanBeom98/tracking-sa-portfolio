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
window.authStateReady = new Promise((resolve) => {
    authReadyResolve = resolve;
});

function resolveAuthReady(user) {
    if (authReadyResolve) {
        authReadyResolve(user);
        authReadyResolve = null;
    }
}

async function getAuthService() {
    if (window.AuthService) return window.AuthService;
    if (window.authDomainReady) {
        const service = await window.authDomainReady;
        if (service) return service;
    }
    return null;
}

async function signInWithProvider(providerId) {
    const authService = await getAuthService();
    if (!authService) {
        alert("로그인 기능이 아직 준비되지 않았습니다.");
        return;
    }
    try {
        await authService.signInWithProvider(providerId);
    } catch (error) {
        console.error("로그인 실패:", error);
        alert("로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
}

function initAuthControls() {
    const container = document.getElementById('auth-controls');
    if (!container) return;

    container.innerHTML = `
        <button id="auth-login" class="auth-button primary">로그인</button>
        <button id="auth-logout" class="auth-button" style="display:none;">로그아웃</button>
        <span id="auth-user" class="auth-user" style="display:none;"></span>
        <div id="auth-menu" class="auth-menu">
            <button type="button" data-provider="google">Google로 로그인</button>
            <div class="auth-form">
                <input id="auth-email" type="email" placeholder="이메일" autocomplete="email">
                <input id="auth-password" type="password" placeholder="비밀번호" autocomplete="current-password">
                <div class="auth-actions">
                    <button type="button" id="auth-email-login" class="auth-button primary">이메일 로그인</button>
                    <button type="button" id="auth-email-signup" class="auth-button">회원가입</button>
                </div>
                <div class="auth-helper">이메일/비밀번호 로그인은 기본 제공업체 설정이 필요합니다.</div>
                <button type="button" id="auth-show-uid" class="auth-button">내 UID 확인</button>
                <div id="auth-uid" class="auth-helper" style="display:none;"></div>
            </div>
        </div>
    `;

    const loginButton = container.querySelector('#auth-login');
    const logoutButton = container.querySelector('#auth-logout');
    const userLabel = container.querySelector('#auth-user');
    const menu = container.querySelector('#auth-menu');
    const emailInput = container.querySelector('#auth-email');
    const passwordInput = container.querySelector('#auth-password');
    const emailLoginBtn = container.querySelector('#auth-email-login');
    const emailSignupBtn = container.querySelector('#auth-email-signup');
    const showUidBtn = container.querySelector('#auth-show-uid');
    const uidLabel = container.querySelector('#auth-uid');
    userLabel.addEventListener('click', () => {
        if (!authUser) return;
        window.location.href = '/account/';
    });

    loginButton.addEventListener('click', (event) => {
        event.preventDefault();
        container.classList.toggle('open');
    });

    menu.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;
        const provider = button.dataset.provider;
        if (!provider) return;
        container.classList.remove('open');
        signInWithProvider(provider);
    });

    emailLoginBtn.addEventListener('click', async () => {
        const authService = await getAuthService();
        if (!authService || !emailInput || !passwordInput) return;
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        if (!email || !password) {
            alert("이메일과 비밀번호를 입력해주세요.");
            return;
        }
        try {
            await authService.signInWithEmail(email, password);
            container.classList.remove('open');
        } catch (error) {
            console.error("이메일 로그인 실패:", error);
            alert("로그인에 실패했습니다. 이메일/비밀번호를 확인해주세요.");
        }
    });

    emailSignupBtn.addEventListener('click', () => {
        window.location.href = `/auth/signup?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    });

    showUidBtn.addEventListener('click', () => {
        const user = window.getCurrentUser ? window.getCurrentUser() : null;
        if (!user || !user.uid) {
            alert("로그인 후 확인할 수 있습니다.");
            return;
        }
        uidLabel.style.display = 'block';
        uidLabel.textContent = `UID: ${user.uid}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(user.uid).catch(() => {});
        }
    });

    logoutButton.addEventListener('click', async () => {
        const authService = await getAuthService();
        if (!authService) return;
        try {
            await authService.signOut();
        } catch (error) {
            console.error("로그아웃 실패:", error);
        }
    });

    document.addEventListener('click', (event) => {
        if (!container.contains(event.target)) {
            container.classList.remove('open');
        }
    });

    window.showAuthMenu = () => {
        if (!container) {
            alert("로그인이 필요합니다.");
            return;
        }
        container.classList.add('open');
    };

    window.updateAuthControls = (user) => {
        if (!container) return;
        if (user) {
            loginButton.style.display = 'none';
            logoutButton.style.display = 'inline-flex';
            userLabel.style.display = 'inline-flex';
            userLabel.textContent = user.displayName || user.email || '로그인됨';
        } else {
            loginButton.style.display = 'inline-flex';
            logoutButton.style.display = 'none';
            userLabel.style.display = 'none';
        }
    };
}

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
        if (window.updateAuthControls) window.updateAuthControls(null);
        return;
    }

    authService.onAuthStateChanged(({ user, profile }) => {
        authUser = user || null;
        authProfile = profile || null;
        resolveAuthReady(authUser);
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

document.addEventListener('DOMContentLoaded', () => {
    window.applyTranslations(currentLang);
    initTheme();
    initLanguageSwitcher();
    updateNewsLinksForLang();
    initDropdownMenus();
    initAuthControls();
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
