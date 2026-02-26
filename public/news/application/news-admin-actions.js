import { getNewsUrlKeyFromPath } from "./news-routing.js";

export const mountAdminDeleteButton = async ({ path, isEnPath }) => {
  const articleCard = document.querySelector(".news-article-card");
  if (!articleCard || !window.db || !window.authStateReady || !window.getCurrentUserProfile) return;

  const urlKey = getNewsUrlKeyFromPath(path);
  if (!urlKey) return;

  await window.authStateReady;
  const profile = window.getCurrentUserProfile();
  if (!profile || profile.role !== "admin") return;

  if (document.querySelector("#news-admin-delete-btn")) return;

  const actions = document.createElement("div");
  actions.className = "news-admin-actions";
  actions.innerHTML = `
    <button id="news-admin-delete-btn" class="news-admin-delete-btn" type="button">기사 삭제</button>
  `;
  articleCard.insertAdjacentElement("afterbegin", actions);

  const button = document.getElementById("news-admin-delete-btn");
  if (!button) return;

  button.addEventListener("click", async () => {
    const ok = window.confirm("이 기사를 삭제할까요? 이 작업은 되돌릴 수 없습니다.");
    if (!ok) return;

    button.disabled = true;
    button.textContent = "삭제 중...";
    try {
      await window.db.collection("posts").doc(urlKey).delete();
      window.alert("삭제되었습니다. 다음 빌드/배포 후 목록에서도 사라집니다.");
      window.location.href = isEnPath ? "/en/news/" : "/news/";
    } catch (err) {
      console.error("News delete failed:", err);
      window.alert("삭제에 실패했습니다. 관리자 권한 또는 규칙을 확인하세요.");
      button.disabled = false;
      button.textContent = "기사 삭제";
    }
  });
};
