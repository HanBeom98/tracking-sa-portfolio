// Resolve at call time: deferred auth may initialize after a page imports this module.
function getGlobal(key) {
  return globalThis[key] ?? globalThis.window?.[key];
}

function getGateway() {
  return getGlobal('AuthGateway');
}

export async function waitAuthReady() {
  const gateway = getGateway();
  if (typeof gateway?.waitForReady === 'function') return gateway.waitForReady();
  return getGlobal('authStateReady') ?? null;
}

export function getCurrentUser() {
  const gateway = getGateway();
  if (typeof gateway?.getCurrentUser === 'function') return gateway.getCurrentUser();
  const legacy = getGlobal('getCurrentUser');
  if (typeof legacy === 'function') return legacy();
  // Compatibility for SDK-only clients. An explicit gateway/legacy null is final.
  const firebase = getGlobal('firebase');
  return typeof firebase?.auth === 'function' ? firebase.auth().currentUser || null : null;
}

export function getCurrentUserProfile() {
  const gateway = getGateway();
  if (typeof gateway?.getCurrentUserProfile === 'function') return gateway.getCurrentUserProfile();
  const legacy = getGlobal('getCurrentUserProfile');
  return typeof legacy === 'function' ? legacy() : null;
}

export async function requireAuth({ redirectTo } = {}) {
  const gateway = getGateway();
  if (typeof gateway?.requireAuth === 'function') return gateway.requireAuth({ redirectTo });
  const legacy = getGlobal('requireAuth');
  return typeof legacy === 'function' ? legacy({ redirectTo }) : null;
}

export async function getAuthService() {
  const gateway = getGateway();
  if (typeof gateway?.getAuthService === 'function') return gateway.getAuthService();
  const service = getGlobal('AuthService');
  if (service) return service;
  const ensureRuntime = getGlobal('ensureAuthRuntime');
  if (typeof ensureRuntime === 'function') await ensureRuntime();
  return getGlobal('AuthService') || getGlobal('authDomainReady') || null;
}

export function subscribeAuthState(listener) {
  if (typeof listener !== 'function') return () => {};
  const gateway = getGateway();
  if (typeof gateway?.subscribe === 'function') return gateway.subscribe(listener);
  const bus = getGlobal('AuthStateBus');
  if (typeof bus?.subscribe === 'function') return bus.subscribe(listener);
  const target = globalThis.window || globalThis;
  if (typeof target.addEventListener !== 'function') return () => {};
  const handler = (event) => {
    const state = event.detail || {};
    const user = Object.hasOwn(state, 'user') ? state.user : getCurrentUser();
    const profile = user ? (Object.hasOwn(state, 'profile') ? state.profile : getCurrentUserProfile()) : null;
    listener({ user, profile });
  };
  target.addEventListener('auth-state-changed', handler);
  return () => target.removeEventListener('auth-state-changed', handler);
}
