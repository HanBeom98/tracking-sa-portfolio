import { getCurrentUser as getBoardCurrentUser, requireAuth as requireBoardAuth } from "./authGateway.js";

const DEFAULT_WRITE_PATH = "/board/write";

function getGlobal(key) {
  if (typeof globalThis !== "object" || !globalThis) return undefined;
  return globalThis[key];
}

const getWritePath = () => {
  const location = getGlobal("location");
  if (location) {
    return (location.pathname || DEFAULT_WRITE_PATH) + (location.search || "");
  }
  const win = getGlobal("window");
  if (win?.location) {
    return (win.location.pathname || DEFAULT_WRITE_PATH) + (win.location.search || "");
  }
  return DEFAULT_WRITE_PATH;
};

async function ensureAuthenticated() {
  return requireBoardAuth({ redirectTo: getWritePath() });
}

function getCurrentUser() {
  return getBoardCurrentUser();
}

export { getWritePath as WRITE_PATH, ensureAuthenticated, getCurrentUser };
