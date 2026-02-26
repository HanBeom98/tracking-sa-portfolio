function createPostDetailUseCases({ postService }) {
  if (!postService) {
    throw new Error("postService is required");
  }

  async function loadPostDetail({ postId, user }) {
    if (!postId) {
      const error = new Error("INVALID_POST_ID");
      error.code = "INVALID_POST_ID";
      throw error;
    }

    const post = await postService.getPost(postId);
    if (!post) return { post: null, canEdit: false };
    const canEdit = user ? postService.canEditPost({ user, post }) : false;
    return { post, canEdit };
  }

  async function deletePost({ postId, user, post }) {
    return postService.deletePost({ id: postId, user, post });
  }

  function canEditPost({ user, post }) {
    return postService.canEditPost({ user, post });
  }

  return {
    loadPostDetail,
    deletePost,
    canEditPost,
  };
}

export { createPostDetailUseCases };
