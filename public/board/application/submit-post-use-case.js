function createSubmitPostUseCase({ postService, getCurrentUser }) {
  if (!postService) {
    throw new Error("postService is required");
  }
  if (typeof getCurrentUser !== "function") {
    throw new Error("getCurrentUser is required");
  }

  return async function submitPost({ values }) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      const error = new Error("AUTH_REQUIRED");
      error.code = "AUTH_REQUIRED";
      throw error;
    }

    await postService.createPost({ ...values, author: currentUser });
  };
}

export { createSubmitPostUseCase };
