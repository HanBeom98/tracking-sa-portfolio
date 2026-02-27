import { getCurrentUser as getBoardCurrentUser, requireAuth as requireBoardAuth } from "./authGateway.js";

const getWritePath = () => (window.location.pathname + window.location.search);

async function ensureAuthenticated() {
  return requireBoardAuth({ redirectTo: getWritePath() });
}

function getCurrentUser() {
  return getBoardCurrentUser();
}

export { getWritePath as WRITE_PATH, ensureAuthenticated, getCurrentUser };
