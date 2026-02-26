const WRITE_PATH = "/board/write";

async function ensureAuthenticated() {
  if (window.requireAuth) {
    return window.requireAuth({ redirectTo: WRITE_PATH });
  }
  return null;
}

function getCurrentUser() {
  return typeof window.getCurrentUser === "function" ? window.getCurrentUser() : null;
}

export { WRITE_PATH, ensureAuthenticated, getCurrentUser };
