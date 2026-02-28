import { fetchGames, fetchMySubmissions, fetchPendingGames, deleteGame } from "./application/game-hub-service.js";

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
    if (hubHeader) {
      try {
        const pending = await fetchPendingGames();
        const pendingCount = pending.length;
        
        const adminBtn = document.createElement("a");
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

function renderGameCard(game, showStatus = false) {
  const authorName = game.authorName || 'Admin';
  const thumbUrl = game.thumbnail || '/favicon.svg';
  const isOfficial = authorName === 'Admin';
  const playCount = game.playCount || 0;
  
  const badgeClass = isOfficial ? 'badge-official' : 'badge-community';
  const badgeText = isOfficial ? 'Official' : 'Community';
  
  const statusHtml = showStatus ? 
    `<span class="status-chip status-${game.status}">${game.status.toUpperCase()}</span>` : 
    '';

  const playUrl = `/games/play/?id=${game.id}`;

  const deleteBtn = (showStatus) ? 
    `<button class="delete-game-btn" data-id="${game.id}" style="background:none; border:none; color:oklch(60% 0.15 20); cursor:pointer; font-size:0.75rem; font-weight:800; padding:0;">[DELETE]</button>` : '';

  return `
    <article class="game-card" id="game-card-${game.id}">
      <div class="game-badge ${badgeClass}">${badgeText}</div>
      <div class="game-thumb">
        <img src="${thumbUrl}" alt="${game.title}" onerror="this.src='/favicon.svg'">
      </div>
      <div class="game-info">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <h3 class="game-card-title">${game.title}</h3>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:5px;">
            ${statusHtml}
            ${deleteBtn}
          </div>
        </div>
        <p class="game-card-desc">${game.description}</p>
        <div class="game-meta">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <span>By ${authorName}</span>
            <span style="font-size: 0.75rem; color: var(--p-blue); font-weight: 700;">${playCount} plays</span>
          </div>
          <a href="${playUrl}" class="play-btn" data-i18n="play_now">PLAY</a>
        </div>
      </div>
    </article>
  `;
}

async function handleGameDelete(e) {
  const btn = e.target.closest(".delete-game-btn");
  if (!btn) return;

  const gameId = btn.dataset.id;
  if (!confirm(t('confirm_delete_game', '정말로 이 게임 제출물을 삭제하시겠습니까?'))) return;

  try {
    btn.disabled = true;
    await deleteGame(gameId);
    document.getElementById(`game-card-${gameId}`)?.remove();
    alert(t('delete_success', '삭제되었습니다.'));
  } catch (err) {
    console.error('[DeleteGame] Failed:', err);
    alert(t('delete_failed', '삭제에 실패했습니다.'));
    btn.disabled = false;
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

  listEl.innerHTML = items.map(g => renderGameCard(g)).join("");
}

function setupFilters() {
  const filterContainer = document.getElementById("category-filters");
  if (filterContainer) {
    // Restore active state from sessionStorage
    filterContainer.querySelectorAll(".filter-chip").forEach(c => {
      if (c.dataset.cat === currentCategory) c.classList.add("active");
      else c.classList.remove("active");
    });

    // Use a fresh listener to avoid multiple bindings
    filterContainer.onclick = (e) => {
      const chip = e.target.closest(".filter-chip");
      if (!chip) return;
      filterContainer.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      currentCategory = chip.dataset.cat;
      sessionStorage.setItem('last_game_cat', currentCategory); // Persist
      filterAndRender();
    };
  }

  // Sorting UI Injection - Prevent duplicate injection
  if (document.querySelector(".sort-container")) return;

  const sortContainer = document.createElement("div");
  sortContainer.className = "sort-container";
  sortContainer.style.display = "flex";
  sortContainer.style.gap = "15px";
  sortContainer.style.marginBottom = "15px";
  sortContainer.style.justifyContent = "flex-end";
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
function renderSkeleton() {
  return `
    <article class="game-card loading-shimmer" style="border-color:var(--bg-sub);">
      <div class="game-thumb" style="background:var(--bg-sub); height:160px;"></div>
      <div class="game-info" style="padding:20px;">
        <div style="height:20px; width:60%; background:var(--bg-sub); border-radius:4px; margin-bottom:10px;"></div>
        <div style="height:14px; width:90%; background:var(--bg-sub); border-radius:4px; margin-bottom:5px;"></div>
        <div style="height:14px; width:40%; background:var(--bg-sub); border-radius:4px;"></div>
      </div>
    </article>
  `.repeat(6);
}

async function initHub() {
  const listEl = document.getElementById("game-list");
  const mySubmissionsContainer = document.getElementById("my-submissions-container");
  const myListEl = document.getElementById("my-game-list");
  if (!listEl) return;

  // Show Skeleton
  listEl.innerHTML = renderSkeleton();

  try {
    // 1. Fetch approved games
    allGames = await fetchGames();

    setupFilters();
    filterAndRender();

    // 2. Fetch my submissions if logged in
    await window.AuthGateway?.waitForReady();
    const user = window.AuthGateway?.getCurrentUser();
    if (user && mySubmissionsContainer && myListEl) {
      const myGames = await fetchMySubmissions();
      if (myGames.length > 0) {
        mySubmissionsContainer.style.display = "block";
        myListEl.innerHTML = myGames.map(g => renderGameCard(g, true)).join("");
        myListEl.onclick = handleGameDelete;
      }
    }
    
    // 3. Admin Check
    await checkAdminAndShowBtn();
  } catch (error) {
    console.error('[GameHub] Init failed:', error);
    listEl.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--error-main);">${t('game_load_failed', '게임 목록을 불러오지 못했습니다.')}</div>`;
  }
}

// Start initialization
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHub);
} else {
  initHub();
}
