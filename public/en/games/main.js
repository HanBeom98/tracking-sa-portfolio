import { gameService } from "./application/gameService.js";
import { gameRenderer } from "./ui/gameRenderer.js";

let allGames = [];
let currentCategory = sessionStorage.getItem('last_game_cat') || 'all';
let currentSort = 'latest'; // 'latest' or 'popular'

function t(key, fallback) {
  return typeof window !== "undefined" && window.getTranslation
    ? window.getTranslation(key, fallback)
    : fallback;
}

async function checkAdminAndShowBtn() {
  if (typeof window === "undefined" || !window.AuthGateway) return;

  await window.AuthGateway.waitForReady();
  const profile = window.AuthGateway.getCurrentUserProfile();
  
  if (profile && profile.role === "admin") {
    const hubHeader = document.querySelector(".hub-header");
    if (hubHeader && !document.getElementById("admin-manage-link")) {
      try {
        const pending = await gameService.getPendingGames();
        const pendingCount = pending.length;
        
        const adminBtn = document.createElement("a");
        adminBtn.id = "admin-manage-link";
        adminBtn.href = "/games/admin/";
        adminBtn.className = "submit-btn";
        adminBtn.style.background = "oklch(60% 0.15 20)";
        adminBtn.style.marginLeft = "10px";
        adminBtn.style.position = "relative";
        
        const badgeHtml = pendingCount > 0 
          ? `<span style="position:absolute; top:-8px; right:-8px; background:#ff4d4f; color:white; border-radius:10px; padding:2px 8px; font-size:0.7rem; font-weight:900; box-shadow:0 2px 5px rgba(0,0,0,0.2); animation: pulse 2s infinite;">${pendingCount}</span>`
          : '';
          
        adminBtn.innerHTML = `Admin: Manage ${badgeHtml}`;
        hubHeader.appendChild(adminBtn);
      } catch (err) {
        console.warn("[AdminBtn] Failed to fetch pending count:", err);
      }
    }
  }
}

function filterAndRender() {
  const listEl = document.getElementById("game-list");
  if (!listEl) return;

  // 1. Filter by category
  let items = currentCategory === 'all' 
    ? [...allGames] 
    : allGames.filter(g => g.category === currentCategory);

  // 2. Sort by criteria
  if (currentSort === 'popular') {
    items.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
  } else {
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  if (items.length === 0) {
    listEl.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-sub);">${t('no_games_in_cat', '해당 카테고리에 게임이 없습니다.')}</div>`;
    return;
  }

  listEl.innerHTML = items.map(g => gameRenderer.renderGameCard(g)).join("");
}

async function handleGameDelete(e) {
  const btn = e.target.closest(".delete-game-btn");
  if (!btn) return;

  const gameId = btn.dataset.id;
  if (!confirm(t('confirm_delete_game', '정말로 이 게임 제출물을 삭제하시겠습니까?'))) return;

  try {
    btn.disabled = true;
    await gameService.deleteGame(gameId);
    document.getElementById(`game-card-${gameId}`)?.remove();
    alert(t('delete_success', '삭제되었습니다.'));
  } catch (err) {
    console.error('[DeleteGame] Failed:', err);
    alert(t('delete_failed', '삭제에 실패했습니다.'));
    btn.disabled = false;
  }
}

function setupFilters() {
  const filterContainer = document.getElementById("category-filters");
  if (filterContainer) {
    filterContainer.querySelectorAll(".filter-chip").forEach(c => {
      if (c.dataset.cat === currentCategory) c.classList.add("active");
      else c.classList.remove("active");
    });

    filterContainer.onclick = (e) => {
      const chip = e.target.closest(".filter-chip");
      if (!chip) return;
      filterContainer.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      currentCategory = chip.dataset.cat;
      sessionStorage.setItem('last_game_cat', currentCategory);
      filterAndRender();
    };
  }

  // Sorting UI
  if (document.querySelector(".sort-container")) return;
  const sortContainer = document.createElement("div");
  sortContainer.className = "sort-container";
  sortContainer.style.cssText = "display:flex; gap:15px; margin-bottom:15px; justify-content:flex-end;";
  sortContainer.innerHTML = `
    <button class="sort-btn ${currentSort === 'latest' ? 'active' : ''}" data-sort="latest" style="background:none; border:none; font-weight:800; cursor:pointer; font-size:0.8rem; color:${currentSort === 'latest' ? 'var(--p-blue)' : 'var(--text-sub)'};">LATEST</button>
    <button class="sort-btn ${currentSort === 'popular' ? 'active' : ''}" data-sort="popular" style="background:none; border:none; font-weight:800; cursor:pointer; font-size:0.8rem; color:${currentSort === 'popular' ? 'var(--p-blue)' : 'var(--text-sub)'};">POPULAR</button>
  `;
  
  const hubWrap = document.querySelector(".games-hub");
  const gameList = document.getElementById("game-list");
  if (hubWrap && gameList) {
    hubWrap.insertBefore(sortContainer, gameList);
    sortContainer.onclick = (e) => {
      const btn = e.target.closest(".sort-btn");
      if (!btn) return;
      sortContainer.querySelectorAll(".sort-btn").forEach(b => {
        b.classList.remove("active");
        b.style.color = "var(--text-sub)";
      });
      btn.classList.add("active");
      btn.style.color = "var(--p-blue)";
      currentSort = btn.dataset.sort;
      filterAndRender();
    };
  }
}

async function initHub() {
  const listEl = document.getElementById("game-list");
  const mySubmissionsContainer = document.getElementById("my-submissions-container");
  const myListEl = document.getElementById("my-game-list");
  if (!listEl) return;

  listEl.innerHTML = gameRenderer.renderSkeleton();

  try {
    allGames = await gameService.getApprovedGames();
    setupFilters();
    filterAndRender();

    await window.AuthGateway?.waitForReady();
    const user = window.AuthGateway?.getCurrentUser();
    if (user && mySubmissionsContainer && myListEl) {
      const myGames = await gameService.getMySubmissions();
      if (myGames.length > 0) {
        mySubmissionsContainer.style.display = "block";
        myListEl.innerHTML = myGames.map(g => gameRenderer.renderGameCard(g, { showStatus: true, onDelete: true })).join("");
        myListEl.onclick = handleGameDelete;
      }
    }
    
    await checkAdminAndShowBtn();
  } catch (error) {
    console.error('[GameHub] Init failed:', error);
    listEl.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--error-main);">${t('game_load_failed', '게임 목록을 불러오지 못했습니다.')}</div>`;
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHub);
} else {
  initHub();
}
