import { resolveBoardRole } from "./admin-role.js?v=5abf0a625b74";
import { assertBoardNickname } from "../domain/author-identity.js?v=c565b2e79da0";

function createSubmitPostUseCase({ postService, getCurrentUser, getCurrentUserProfile }) {
  if (!postService) {
    throw new Error("postService is required");
  }
  if (typeof getCurrentUser !== "function") {
    throw new Error("getCurrentUser is required");
  }

  return async function submitPost({ values }) {
    const authUser = getCurrentUser();
    if (!authUser) {
      const error = new Error("AUTH_REQUIRED");
      error.code = "AUTH_REQUIRED";
      throw error;
    }

    // Merge profile data (role, etc.) if available
    const profile = typeof getCurrentUserProfile === "function" ? getCurrentUserProfile() : null;
    const nickname = assertBoardNickname(profile);
    const author = {
      ...authUser,
      role: resolveBoardRole({ user: authUser, profile }),
      nickname,
      displayName: nickname,
    };

    await postService.createPost({ ...values, author });
  };
}

export { createSubmitPostUseCase };
