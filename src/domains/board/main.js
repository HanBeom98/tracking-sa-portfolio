import { buildPostService } from "./application/postService.js";
import { createFirestorePostRepository } from "./infra/firestorePostRepository.js";
import { readBoardListCache, writeBoardListCache } from "./application/board-list-cache.js";

const postService = buildPostService({
  postRepository: createFirestorePostRepository(),
});

const boardList = document.getElementById("board-list");

async function loadPosts() {
  if (!boardList) return;
  try {
    boardList.setAttribute("status", "loading");
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get("category");
    boardList.setAttribute("category", category || "");
    const cachedPosts = readBoardListCache({ category });
    if (cachedPosts) {
      boardList.setPosts(cachedPosts);
      boardList.setAttribute("status", "ready");
      return;
    }
    const posts = await postService.listPosts({ limit: 30, category });
    writeBoardListCache(posts, { category });
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
