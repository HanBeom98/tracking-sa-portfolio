import { buildPostService } from "../application/postService.js?v=2449ae7299bf";
import { createFirestorePostRepository } from "../infra/firestorePostRepository.js?v=cf90e0c82e04";
import { ensureAuthenticated, getCurrentUser } from "../application/write-auth.js?v=182646496680";
import { waitAuthReady, getCurrentUserProfile, subscribeAuthState } from "../application/authGateway.js?v=6e4dcb33b658";
import { resolveBoardRole } from "../application/admin-role.js?v=5abf0a625b74";
import { createSubmitPostUseCase } from "../application/submit-post-use-case.js?v=beffe2b1ed91";
import { renderWriteAccess } from "../ui/write-access-renderer.js?v=175c04fb7a21";
import { deleteBoardImages, uploadBoardImages } from "../infra/board-image-service.js?v=d006292ada93";
import { clearBoardListCache } from "../application/board-list-cache.js?v=d5c9336d3e19";
import { assertBoardNickname } from "../domain/author-identity.js?v=c565b2e79da0";
import { reportImageCleanup } from "../ui/image-cleanup-feedback.js?v=443db3346b82";

const postService = buildPostService({
  postRepository: createFirestorePostRepository(),
});
const submitPost = createSubmitPostUseCase({ postService, getCurrentUser, getCurrentUserProfile });

const t = (key, fallback) => (
  window.getTranslation ? window.getTranslation(key, fallback) : fallback
);

function getBoardRedirectPath(category = "free") {
  return category === "notice" ? "/board?category=notice" : "/board";
}

function applyWriteFormRole(writeForm, authState = {}) {
  const user = Object.hasOwn(authState, 'user') ? authState.user : getCurrentUser();
  const profile = Object.hasOwn(authState, 'profile') ? authState.profile : getCurrentUserProfile();
  writeForm.setAttribute("user-role", resolveBoardRole({ user, profile }));
}

function showError(error) {
  switch (error.code) {
    case "NICKNAME_REQUIRED":
      alert("게시글을 작성하려면 내 계정에서 사이트 회원 닉네임을 설정해 주세요.");
      return;
    case "permission-denied":
      alert("닉네임 설정과 작성 권한을 확인한 뒤 새로고침해 주세요.");
      return;
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
      alert(t("board_write_auth_required", "게시글 작성은 로그인 후 이용할 수 있습니다."));
      return;
    default:
      alert(t("post_create_failed", "게시물 등록에 실패했습니다. 잠시 후 다시 시도해주세요."));
  }
}

function bindWriteSubmit(writeForm, section) {
  writeForm.onSubmit(async (values) => {
    writeForm.setSubmitting(true);
    let uploadedPaths = [];
    let uploadOwnerUid = null;
    try {
      const user = getCurrentUser();
      if (!user) {
        const error = new Error("AUTH_REQUIRED");
        error.code = "AUTH_REQUIRED";
        throw error;
      }
      uploadOwnerUid = user.uid;
      assertBoardNickname(getCurrentUserProfile());
      const uploaded = await uploadBoardImages({ items: values.attachments, uid: user.uid });
      uploadedPaths = uploaded.uploadedPaths;
      await submitPost({ values: { ...values, attachments: uploaded.attachments } });
    } catch (error) {
      const cleanup = error.imageCleanupResult || await deleteBoardImages(uploadedPaths, { ownerUid: uploadOwnerUid });
      if (error && error.code === "AUTH_REQUIRED") {
        renderWriteAccess({ section, writeForm, user: null });
      }
      if (error?.code === "NICKNAME_REQUIRED") {
        renderWriteAccess({ section, writeForm, user: getCurrentUser(), profile: getCurrentUserProfile() });
      }
      console.error("게시물 등록 실패:", error);
      showError(error);
      reportImageCleanup(cleanup);
      writeForm.setSubmitting(false);
      return;
    }
    clearBoardListCache();
    alert(t("post_create_success", "게시물이 성공적으로 등록되었습니다."));
    window.location.href = getBoardRedirectPath(values.category);
  });
}

function getWritePageElements() {
  const section = document.querySelector(".write-form-section");
  const writeForm = document.querySelector("board-write-form");
  return { section, writeForm };
}

async function initWriteForm() {
  const { section, writeForm } = getWritePageElements();
  if (!section) return;
  if (!writeForm) throw new Error("board-write-form not found");

  // 폼은 인증 초기화보다 먼저 렌더링될 수 있으므로 제출 핸들러부터 연결한다.
  // 인증이 아직 준비되지 않은 경우에도 버튼이 무반응으로 보이지 않고
  // submit use-case가 명확한 AUTH_REQUIRED 응답을 반환한다.
  bindWriteSubmit(writeForm, section);

  // Firebase restores the persisted session asynchronously. Waiting here prevents
  // a signed-in admin from being treated as a guest during the first render.
  await waitAuthReady();
  const user = await ensureAuthenticated();
  renderWriteAccess({ section, writeForm, user, profile: getCurrentUserProfile() });
  if (!user) return;

  // Pass user role and initial category to form
  const urlParams = new URLSearchParams(window.location.search);
  const category = urlParams.get("category") || "free";
  applyWriteFormRole(writeForm);
  writeForm.setAttribute("initial-category", category);

  // Update title dynamically
  const h1 = section.querySelector("h1");
  if (h1) {
    if (category === "notice") {
      h1.textContent = t("notice_write_h1", "공지사항 글쓰기");
      h1.setAttribute("data-i18n", "notice_write_h1");
    } else {
      h1.textContent = t("write_post_h1", "자유게시판 글쓰기");
      h1.setAttribute("data-i18n", "write_post_h1");
    }
  }
}

function bindAuthStateUpdates() {
  return subscribeAuthState(({ user, profile }) => {
    const { section, writeForm } = getWritePageElements();
    if (!section || !writeForm) return;
    renderWriteAccess({ section, writeForm, user: user || null, profile });
    applyWriteFormRole(writeForm, { user, profile });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initWriteForm();
  const unsubscribe = bindAuthStateUpdates();
  window.addEventListener("pagehide", () => unsubscribe(), { once: true });
});
