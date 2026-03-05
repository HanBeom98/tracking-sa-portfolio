import { getCurrentUser as getBoardCurrentUser, requireAuth as requireBoardAuth } from "./authGateway.js";

const DEFAULT_WRITE_PATH = "/board/write";

const getWritePath = () => {
  if (typeof window !== "undefined" && window.location) {
    return window.location.pathname + window.location.search;
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
