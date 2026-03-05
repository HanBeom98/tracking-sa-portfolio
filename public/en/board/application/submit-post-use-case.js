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
    const author = {
      ...authUser,
      role: (profile && profile.role) || "free",
      displayName: (profile && profile.nickname) || authUser.displayName,
    };

    await postService.createPost({ ...values, author });
  };
}

export { createSubmitPostUseCase };
