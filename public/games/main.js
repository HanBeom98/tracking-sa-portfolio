import { fetchGames } from "./application/game-hub-service.js";

function t(key, fallback) {
  return typeof window !== "undefined" && window.getTranslation
    ? window.getTranslation(key, fallback)
    : fallback;
}

function renderGameCard(game) {
  const authorName = game.authorName || 'Admin';
  const thumbUrl = game.thumbnail || '/favicon.svg';
  
  return `
    <article class="game-card">
      <div class="game-thumb">
        <img src="${thumbUrl}" alt="${game.title}" onerror="this.src='/favicon.svg'">
      </div>
      <div class="game-info">
        <h3 class="game-card-title">${game.title}</h3>
        <p class="game-card-desc">${game.description}</p>
        <div class="game-meta">
          <span>By ${authorName}</span>
          <a href="${game.url}" class="play-btn" data-i18n="play_now">PLAY</a>
        </div>
      </div>
    </article>
  `;
}

async function initHub() {
  const listEl = document.getElementById("game-list");
  if (!listEl) return;

  try {
    const games = await fetchGames();
    
    if (games.length === 0) {
      listEl.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-sub);">${t('no_games_found', '등록된 게임이 없습니다.')}</div>`;
      return;
    }

    listEl.innerHTML = games.map(renderGameCard).join("");
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
