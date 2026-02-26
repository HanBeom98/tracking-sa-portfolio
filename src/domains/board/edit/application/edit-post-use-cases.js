function createEditPostUseCases({ postService }) {
  if (!postService) {
    throw new Error("postService is required");
  }

  async function loadEditablePost({ postId, user }) {
    if (!postId) {
      const error = new Error("INVALID_POST_ID");
      error.code = "INVALID_POST_ID";
      throw error;
    }
    if (!user) {
      const error = new Error("AUTH_REQUIRED");
      error.code = "AUTH_REQUIRED";
      throw error;
    }

    const post = await postService.getPost(postId);
    if (!post) return null;
    if (!postService.canEditPost({ user, post })) {
      const error = new Error("NOT_AUTHORIZED");
      error.code = "NOT_AUTHORIZED";
      throw error;
    }
    return post;
  }

  async function submitEdit({ postId, user, post, values }) {
    return postService.updatePost({
      id: postId,
      title: values.title,
      content: values.content,
      user,
      post,
    });
  }

  return {
    loadEditablePost,
    submitEdit,
  };
}

export { createEditPostUseCases };
