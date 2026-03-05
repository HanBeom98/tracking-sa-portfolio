import { buildPostService } from "./application/postService.js";
import { createFirestorePostRepository } from "./infra/firestorePostRepository.js";
import { createCryptoAdapter } from "./infra/cryptoAdapter.js";

const postService = buildPostService({
  postRepository: createFirestorePostRepository(),
  crypto: createCryptoAdapter(),
});

const boardList = document.getElementById("board-list");

async function loadPosts() {
  if (!boardList) return;
  try {
    boardList.setAttribute("status", "loading");
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get("category");
    boardList.setAttribute("category", category || "");
    const posts = await postService.listPosts({ limit: 30, category });
    boardList.setPosts(posts);
    boardList.setAttribute("status", "ready");
  } catch (error) {
    console.error("게시물 목록 로딩 실패:", error);
    boardList.setAttribute("status", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadPosts();
});
