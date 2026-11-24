import { buildPostService } from "../application/postService.js";
import { requireAuth, waitAuthReady, getCurrentUser, getCurrentUserProfile } from "../application/authGateway.js";
import { createFirestorePostRepository } from "../infra/firestorePostRepository.js";
import { waitForFirestoreReady } from "../infra/firestore-ready.js";
import { createEditPostUseCases } from "../application/edit-post-use-cases.js";
import { deleteBoardImages, uploadBoardImages } from "../infra/board-image-service.js";
import { clearBoardListCache } from "../application/board-list-cache.js";
import { reportImageCleanup } from "../ui/image-cleanup-feedback.js";

const t = (key, fallback) => (
  window.getTranslation ? window.getTranslation(key, fallback) : fallback
);

const postId = new URLSearchParams(window.location.search).get("id");
const editForm = document.querySelector("board-edit-form");
if (!editForm) {
  throw new Error("board-edit-form not found");
}
if (editForm && postId) {
  editForm.setAttribute("cancel-href", `/board/post?id=${postId}`);
}

function showError(error) {
  switch (error.code) {
    case "REQUIRED_FIELDS":
      alert(t("post_required_fields", "모든 필드를 입력해주세요."));
      return;
    case "IMAGE_ATTACHMENT_NOT_OWNED":
      alert("첨부 이미지의 소유권 또는 주소를 확인할 수 없습니다. 해당 이미지를 제거한 뒤 다시 첨부해 주세요.");
      return;
    case "POST_TOO_LONG":
      alert("제목은 120자, 본문은 10,000자 이하로 입력해 주세요.");
      return;
    case "AUTH_REQUIRED":
      alert(t("board_edit_auth_required", "게시글 수정은 로그인 후 이용할 수 있습니다."));
      return;
    case "NOT_AUTHORIZED":
      alert(t("post_not_authorized", "수정 권한이 없습니다."));
      return;
    default:
      alert(t("post_edit_failed", "게시물 수정에 실패했습니다. 잠시 후 다시 시도해주세요."));
  }
}

function attachSubmit(post, user) {
  editForm.onSubmit(async (values) => {
    editForm.setSubmitting(true);
    let uploadedPaths = [];
    let removedPaths = [];
    try {
      const uploaded = await uploadBoardImages({ items: values.attachments, uid: post.authorUid });
      uploadedPaths = uploaded.uploadedPaths;
      const retainedPaths = new Set(uploaded.attachments.map((attachment) => attachment.path));
      removedPaths = (post.attachments || [])
        .map((attachment) => attachment.path)
        .filter((path) => path && !retainedPaths.has(path));
      const postService = buildPostService({
        postRepository: createFirestorePostRepository(),
      });
      const editPostUseCases = createEditPostUseCases({ postService });
      await editPostUseCases.submitEdit({ postId, user, post, values: { ...values, attachments: uploaded.attachments } });
    } catch (error) {
      const cleanup = error.imageCleanupResult || await deleteBoardImages(uploadedPaths, { ownerUid: post.authorUid });
      console.error("게시물 수정 실패:", error);
      showError(error);
      reportImageCleanup(cleanup);
      editForm.setSubmitting(false);
      return;
    }
    clearBoardListCache();
    const cleanup = await deleteBoardImages(removedPaths, { ownerUid: post.authorUid });
    alert(t("post_edit_success", "게시물이 성공적으로 수정되었습니다."));
    reportImageCleanup(cleanup);
    window.location.href = `/board/post?id=${postId}`;
  });
}

function buildEditorUser(authUser) {
  if (!authUser) return null;
  const profile = getCurrentUserProfile();
  return {
    ...authUser,
    role: (profile && profile.role) || "free",
  };
}

async function resolveEditorUser({ postId, authTimeoutMs = 4000 }) {
  const currentUser = getCurrentUser();
  if (currentUser) {
    return buildEditorUser(currentUser);
  }

  const authUser = await Promise.race([
    waitAuthReady().catch((error) => {
      console.error("게시물 수정 사용자 정보 로딩 실패:", error);
      return null;
    }),
    new Promise((resolve) => {
      setTimeout(() => resolve(null), authTimeoutMs);
    }),
  ]);

  if (authUser) {
    return buildEditorUser(authUser);
  }

  const requiredUser = await requireAuth({ redirectTo: `/board/edit?id=${postId}` });
  return buildEditorUser(requiredUser);
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!postId) {
    editForm.renderNotFound();
    return;
  }

  try {
    await waitForFirestoreReady();
    const postService = buildPostService({
      postRepository: createFirestorePostRepository(),
    });
    const editPostUseCases = createEditPostUseCases({ postService });
    const user = await resolveEditorUser({ postId });
    if (!user) {
      editForm.renderNotFound();
      return;
    }

    const post = await editPostUseCases.loadEditablePost({ postId, user });
    if (!post) {
      editForm.renderNotFound();
      return;
    }
    editForm.renderForm({ title: post.title, content: post.content, attachments: post.attachments || [] });
    attachSubmit(post, user);
  } catch (error) {
    console.error("게시물 정보 로딩 실패:", error);
    editForm.renderNotFound();
  }
});
