const WRITE_PATH = "/board/write";

function getAuthGateway() {
  return window.AuthGateway || null;
}

async function ensureAuthenticated() {
  const gateway = getAuthGateway();
  if (gateway && gateway.requireAuth) {
    return gateway.requireAuth({ redirectTo: WRITE_PATH });
  }
  if (window.requireAuth) {
    return window.requireAuth({ redirectTo: WRITE_PATH });
  }
  return null;
}

function getCurrentUser() {
  const gateway = getAuthGateway();
  if (gateway && gateway.getCurrentUser) return gateway.getCurrentUser();
  return typeof window.getCurrentUser === "function" ? window.getCurrentUser() : null;
}

export { WRITE_PATH, ensureAuthenticated, getCurrentUser };
