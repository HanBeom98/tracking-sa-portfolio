/**
 * Tracking SA Core Runtime
 * app shell/i18n setup is delegated to app-shell-runtime.js
 */

let authUser = null;
let authProfile = null;
let authUiController = null;
let authPromptKit = null;
let inlineModalController = null;
let authStateBus = null;
let appShellRuntime = null;
let authSessionRuntime = null;
window.authStateReady = Promise.resolve(null);

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

async function loadAppShellRuntimeFactory() {
    if (typeof window.createAppShellRuntime === "function") {
        return window.createAppShellRuntime;
    }
    await new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-app-shell-runtime="true"]');
        if (existing) {
            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener("error", reject, { once: true });
            return;
        }
        const script = document.createElement("script");
        script.src = "/app-shell-runtime.js";
        script.async = true;
        script.dataset.appShellRuntime = "true";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
    return window.createAppShellRuntime;
}

async function loadAuthSessionRuntimeFactory() {
    if (typeof window.createAuthSessionRuntime === "function") {
        return window.createAuthSessionRuntime;
    }
    await new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-auth-session-runtime="true"]');
        if (existing) {
            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener("error", reject, { once: true });
            return;
        }
        const script = document.createElement("script");
        script.src = "/auth-session-runtime.js";
        script.async = true;
        script.dataset.authSessionRuntime = "true";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
    return window.createAuthSessionRuntime;
}

async function ensureAppShellRuntime() {
    if (appShellRuntime) return appShellRuntime;
    const factory = await loadAppShellRuntimeFactory();
    if (typeof factory !== "function") {
        throw new Error("App shell runtime factory is not available.");
    }
    appShellRuntime = factory();
    return appShellRuntime;
}

async function ensureAuthSessionRuntime() {
    if (authSessionRuntime) return authSessionRuntime;
    const factory = await loadAuthSessionRuntimeFactory();
    if (typeof factory !== "function") {
        throw new Error("Auth session runtime factory is not available.");
    }
    authSessionRuntime = factory({
        getAuthService,
        onStateChanged({ user, profile }) {
            authUser = user || null;
            authProfile = profile || null;
            publishAuthStateChange(authUser, authProfile);
            if (window.updateAuthControls) window.updateAuthControls(authUser);
        },
        onAuthRequired() {
            if (window.showAuthMenu) window.showAuthMenu();
        },
    });
    window.authStateReady = authSessionRuntime.waitForReady();
    return authSessionRuntime;
}

async function loadInlineLoginModalFactory() {
    await loadAuthActionHandlersFactory();
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

async function loadAuthActionHandlersFactory() {
    if (typeof window.createAuthActionHandlers === "function") {
        return window.createAuthActionHandlers;
    }
    await new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-auth-action-handlers="true"]');
        if (existing) {
            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener("error", reject, { once: true });
            return;
        }
        const script = document.createElement("script");
        script.src = "/auth-action-handlers.js";
        script.async = true;
        script.dataset.authActionHandlers = "true";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
    return window.createAuthActionHandlers;
}

async function loadAuthUiControllerFactory() {
    await loadAuthActionHandlersFactory();
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

async function loadAuthPromptKitFactory() {
    if (typeof window.createAuthPromptKit === "function") {
        return window.createAuthPromptKit;
    }
    await new Promise((resolve, reject) => {
        const existing = document.querySelector('script[data-auth-prompt-kit="true"]');
        if (existing) {
            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener("error", reject, { once: true });
            return;
        }
        const script = document.createElement("script");
        script.src = "/auth-prompt-kit.js";
        script.async = true;
        script.dataset.authPromptKit = "true";
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
    return window.createAuthPromptKit;
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

async function ensureAuthPromptKit() {
    if (authPromptKit) return authPromptKit;
    const factory = await loadAuthPromptKitFactory();
    if (typeof factory !== "function") {
        throw new Error("Auth prompt kit factory is not available.");
    }
    authPromptKit = factory({
        ensureInlineLoginModalController,
        openAuthPrompt: () => {
            if (window.openAuthPrompt) window.openAuthPrompt();
        },
        getAuthStateReady: () => window.authStateReady,
        showAuthMenu: () => {
            if (window.showAuthMenu) window.showAuthMenu();
        },
        getTranslation: (key, fallback) => window.getTranslation(key, fallback),
    });
    return authPromptKit;
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
        alert(window.getTranslation("auth_controls_unavailable", "로그인 UI를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."));
        return;
    }
    authUiController.showAuthMenu();
};

window.openAuthPrompt = () => {
    if (!authUiController) {
        alert(window.getTranslation("auth_controls_unavailable", "로그인 UI를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."));
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
        const kit = await ensureAuthPromptKit();
        return kit.openInlineLoginModal({ redirectTo });
    } catch (error) {
        console.error("Auth prompt kit openInlineLoginModal failed:", error);
        alert(window.getTranslation("auth_ui_load_failed", "로그인 기능을 불러오지 못했습니다. 잠시 후 다시 시도해주세요."));
        return null;
    }
};

window.promptLogin = async ({ redirectTo = "/" } = {}) => {
    try {
        const kit = await ensureAuthPromptKit();
        return kit.promptLogin({ redirectTo });
    } catch (error) {
        console.error("Auth prompt kit promptLogin failed:", error);
        if (window.openAuthPrompt) window.openAuthPrompt();
        return null;
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
    if (authPromptKit && typeof authPromptKit.createLoginRequiredPrompt === "function") {
        return authPromptKit.createLoginRequiredPrompt({
            promptId,
            wrapperClass,
            messageKey,
            messageText,
            buttonId,
            redirectTo,
        });
    }

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

window.getCurrentUser = () => (
    authSessionRuntime && typeof authSessionRuntime.getCurrentUser === "function"
        ? authSessionRuntime.getCurrentUser()
        : authUser
);
window.getCurrentUserProfile = () => (
    authSessionRuntime && typeof authSessionRuntime.getCurrentUserProfile === "function"
        ? authSessionRuntime.getCurrentUserProfile()
        : authProfile
);
window.requireAuth = async ({ redirectTo } = {}) => {
    const runtime = await ensureAuthSessionRuntime();
    return runtime.requireAuth({ redirectTo });
};

window.AuthGateway = {
    waitForReady: async () => {
        const runtime = await ensureAuthSessionRuntime();
        return runtime.waitForReady();
    },
    getCurrentUser: () => (
        authSessionRuntime && typeof authSessionRuntime.getCurrentUser === "function"
            ? authSessionRuntime.getCurrentUser()
            : authUser
    ),
    getCurrentUserProfile: () => (
        authSessionRuntime && typeof authSessionRuntime.getCurrentUserProfile === "function"
            ? authSessionRuntime.getCurrentUserProfile()
            : authProfile
    ),
    requireAuth: async ({ redirectTo } = {}) => {
        const runtime = await ensureAuthSessionRuntime();
        return runtime.requireAuth({ redirectTo });
    },
    getAuthService,
};

document.addEventListener('DOMContentLoaded', async () => {
    const shell = await ensureAppShellRuntime();
    shell.initShell();
    await ensureAuthStateBus();
    await ensureAuthPromptKit();
    await initAuthControls();
    if (authPromptKit && typeof authPromptKit.initAuthGateLinks === "function") {
        authPromptKit.initAuthGateLinks();
    }
    const sessionRuntime = await ensureAuthSessionRuntime();
    await sessionRuntime.init();
    
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
