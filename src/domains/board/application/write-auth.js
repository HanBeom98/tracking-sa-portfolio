import { getCurrentUser as getBoardCurrentUser, requireAuth as requireBoardAuth } from "./authGateway.js";

const WRITE_PATH = "/board/write";

async function ensureAuthenticated() {
  return requireBoardAuth({ redirectTo: WRITE_PATH });
}

function getCurrentUser() {
  return getBoardCurrentUser();
}

export { WRITE_PATH, ensureAuthenticated, getCurrentUser };
