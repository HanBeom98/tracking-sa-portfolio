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

let _authStateResolve = null;
window.authStateReady = new Promise((resolve) => {
    _authStateResolve = resolve;
});

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
            if (typeof window.createAuthStateBus === "function") {
                resolve();
                return;
            }
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

async function loadFactoryScript({
    factoryName,
    scriptSrc,
    dataAttr,
}) {
    if (typeof window[factoryName] === "function") {
        return window[factoryName];
    }
    await new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[${dataAttr}="true"]`);
        if (existing) {
            if (typeof window[factoryName] === "function") {
                resolve();
                return;
            }
            existing.addEventListener("load", resolve, { once: true });
            existing.addEventListener("error", reject, { once: true });
            return;
        }
        const script = document.createElement("script");
        script.src = scriptSrc;
        script.async = true;
        script.setAttribute(dataAttr, "true");
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
    return window[factoryName];
}

async function loadAppShellRuntimeFactory() {
    return loadFactoryScript({
        factoryName: "createAppShellRuntime",
        scriptSrc: "/app-shell-runtime.js",
        dataAttr: "data-app-shell-runtime",
    });
}

async function loadAuthSessionRuntimeFactory() {
    return loadFactoryScript({
        factoryName: "createAuthSessionRuntime",
        scriptSrc: "/auth-session-runtime.js",
        dataAttr: "data-auth-session-runtime",
    });
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
    authSessionRuntime.waitForReady().then((user) => {
        if (_authStateResolve) _authStateResolve(user);
    });
    return authSessionRuntime;
}

async function loadInlineLoginModalFactory() {
    await loadAuthActionHandlersFactory();
    return loadFactoryScript({
        factoryName: "createInlineLoginModalController",
        scriptSrc: "/inline-login-modal.js",
        dataAttr: "data-inline-login-modal",
    });
}

async function loadAuthActionHandlersFactory() {
    return loadFactoryScript({
        factoryName: "createAuthActionHandlers",
        scriptSrc: "/auth-action-handlers.js",
        dataAttr: "data-auth-action-handlers",
    });
}

async function loadAuthUiControllerFactory() {
    await loadAuthActionHandlersFactory();
    return loadFactoryScript({
        factoryName: "createAuthUiController",
        scriptSrc: "/auth-ui-controller.js",
        dataAttr: "data-auth-ui-controller",
    });
}

async function loadAuthPromptKitFactory() {
    return loadFactoryScript({
        factoryName: "createAuthPromptKit",
        scriptSrc: "/auth-prompt-kit.js",
        dataAttr: "data-auth-prompt-kit",
    });
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

let pendingAuthUiControllerPromise = null;

async function ensureAuthUiController() {
    if (authUiController) return authUiController;
    if (pendingAuthUiControllerPromise) return pendingAuthUiControllerPromise;
    
    pendingAuthUiControllerPromise = (async () => {
        try {
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
        } finally {
            pendingAuthUiControllerPromise = null;
        }
    })();
    
    return pendingAuthUiControllerPromise;
}

async function initAuthControls() {
    try {
        const controller = await ensureAuthUiController();
        await controller.init();
    } catch (error) {
        console.error("Auth UI controller init failed:", error);
    }
}

window.showAuthMenu = async () => {
    if (!authUiController) {
        try {
            await ensureAuthUiController();
        } catch (e) {
            console.error("Failed to load Auth UI on demand:", e);
        }
    }
    if (!authUiController) {
        alert(window.getTranslation("auth_controls_unavailable", "로그인 기능이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요."));
        return;
    }
    authUiController.showAuthMenu();
};

window.openAuthPrompt = async () => {
    if (!authUiController) {
        try {
            await ensureAuthUiController();
        } catch (e) {
            console.error("Failed to load Auth UI on demand:", e);
        }
    }
    if (!authUiController) {
        alert(window.getTranslation("auth_controls_unavailable", "로그인 기능이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요."));
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
        return window.authStateReady;
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

async function initAll() {
    const shell = await ensureAppShellRuntime();
    shell.initShell();
    
    // 인증 세션 초기화를 우선 시작하여 상태 변화를 감지할 준비를 마침
    const sessionRuntime = await ensureAuthSessionRuntime();
    const initPromise = sessionRuntime.init(); // 비동기 초기화 시작
    
    await ensureAuthStateBus();
    await ensureAuthPromptKit();
    await initAuthControls(); // UI 렌더링 시도
    
    if (authPromptKit && typeof authPromptKit.initAuthGateLinks === "function") {
        authPromptKit.initAuthGateLinks();
    }
    
    // 초기화 완료 대기
    await initPromise;
    
    // 초기화 직후 한 번 더 UI 강제 업데이트 (상태 유실 방지)
    const currentUser = sessionRuntime.getCurrentUser();
    if (currentUser && window.updateAuthControls) {
        window.updateAuthControls(currentUser);
    }
}

if (document.readyState === "loading") {
    document.addEventListener('DOMContentLoaded', initAll);
} else {
    initAll();
}
