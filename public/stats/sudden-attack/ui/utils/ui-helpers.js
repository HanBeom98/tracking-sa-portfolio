import { escapeHtml } from '../../../../shared/html.js?v=d181848c5b3c';

/**
 * UI Helpers for Sudden Attack Domain
 */

/**
 * Time Ago Helper for SWR
 */
export function getTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return '방금 전';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  return `${hours}시간 전`;
}

/**
 * Update SWR Status Bar UI
 */
const swrUpdates = new WeakMap();

export function updateSwrUI(swrStatus, type, timestamp = null) {
  if (!swrStatus) return;
  const update = {};
  swrUpdates.set(swrStatus, update);
  swrStatus.classList.remove('hidden-out');

  if (type === 'stale') {
    const timeText = getTimeAgo(timestamp);
    swrStatus.innerHTML = `<span class="spin">🔄</span> ${timeText} 데이터를 표시 중입니다. 최신 정보로 갱신 중...`;
    swrStatus.className = 'swr-status stale';
    swrStatus.classList.remove('hidden');
  } else if (type === 'fresh') {
    swrStatus.innerHTML = `✨ 최신 데이터로 업데이트되었습니다!`;
    swrStatus.className = 'swr-status fresh';
    swrStatus.classList.remove('hidden');
    setTimeout(() => {
      if (swrUpdates.get(swrStatus) !== update) return;
      swrStatus.classList.add('hidden-out');
      setTimeout(() => {
        if (swrUpdates.get(swrStatus) !== update) return;
        swrStatus.classList.add('hidden');
        swrStatus.classList.remove('hidden-out');
      }, 500);
    }, 3000);
  } else if (type === 'error') {
    swrStatus.textContent = '기존 데이터를 표시 중입니다. 최신 정보 갱신은 잠시 후 다시 시도해 주세요.';
    swrStatus.className = 'swr-status stale';
    swrStatus.classList.remove('hidden');
  } else {
    swrStatus.classList.add('hidden');
  }
}

/**
 * Recent Search Management
 */
export function normalizeSearchName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

const unsavedNames = new Map();

function parseStoredNames(storageKey) {
  if (unsavedNames.has(storageKey)) return unsavedNames.get(storageKey);
  try {
    const data = localStorage.getItem(storageKey);
    const parsed = data ? JSON.parse(data) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredNames(storageKey, names) {
  unsavedNames.set(storageKey, names);
  try {
    localStorage.setItem(storageKey, JSON.stringify(names));
    unsavedNames.delete(storageKey);
  } catch {}
}

function dedupeNames(names, limit) {
  const seen = new Set();
  const next = [];
  names.forEach((name) => {
    const normalized = normalizeSearchName(name);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    next.push(normalized);
  });
  return typeof limit === 'number' ? next.slice(0, limit) : next;
}

export function getRecentSearches(storageKey) {
  return dedupeNames(parseStoredNames(storageKey), 5);
}

export function saveSearch(storageKey, name) {
  const normalized = normalizeSearchName(name);
  if (!normalized) return;
  const searches = dedupeNames([normalized, ...getRecentSearches(storageKey)], 5);
  writeStoredNames(storageKey, searches);
}

export function clearRecentSearches(storageKey) {
  unsavedNames.set(storageKey, []);
  try {
    localStorage.removeItem(storageKey);
    unsavedNames.delete(storageKey);
  } catch {}
}

export function getFavoriteSearches(storageKey) {
  return dedupeNames(parseStoredNames(storageKey), 8);
}

export function isFavoriteSearch(storageKey, name) {
  const normalized = normalizeSearchName(name).toLowerCase();
  return getFavoriteSearches(storageKey).some((item) => item.toLowerCase() === normalized);
}

export function toggleFavoriteSearch(storageKey, name) {
  const normalized = normalizeSearchName(name);
  if (!normalized) return false;
  const favorites = getFavoriteSearches(storageKey);
  const key = normalized.toLowerCase();
  const exists = favorites.some((item) => item.toLowerCase() === key);
  const next = exists
    ? favorites.filter((item) => item.toLowerCase() !== key)
    : dedupeNames([normalized, ...favorites.filter((item) => item.toLowerCase() !== key)], 8);
  writeStoredNames(storageKey, next);
  return !exists;
}

export function removeFavoriteSearch(storageKey, name) {
  const key = normalizeSearchName(name).toLowerCase();
  const favorites = getFavoriteSearches(storageKey).filter((item) => item.toLowerCase() !== key);
  writeStoredNames(storageKey, favorites);
}

export function renderRecentSearches(container, storageKey, onSearch, onClear = null, emptyMessage = '') {
  if (!container) return;
  const searches = getRecentSearches(storageKey);
  container.dataset.hasItems = String(searches.length > 0);
  if (searches.length === 0) {
    container.innerHTML = emptyMessage
      ? `<span class="search-empty-state">${escapeHtml(emptyMessage)}</span>`
      : '';
    return;
  }
  container.innerHTML =
    `<span>최근 검색:</span>` +
    searches.map((s) => `<button class="search-chip" data-name="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('') +
    `<button class="chip-action-btn" data-action="clear">전체 비우기</button>`;
  container.querySelectorAll('.search-chip').forEach(btn => {
    btn.addEventListener('click', () => { onSearch(btn.dataset.name || btn.textContent); });
  });
  const clearBtn = container.querySelector('[data-action="clear"]');
  if (clearBtn && typeof onClear === 'function') {
    clearBtn.addEventListener('click', onClear);
  }
}

export function renderFavoriteSearches(container, storageKey, onSearch, onRemove = null, onCompare = null, emptyMessage = '') {
  if (!container) return;
  const favorites = getFavoriteSearches(storageKey);
  container.dataset.hasItems = String(favorites.length > 0);
  if (favorites.length === 0) {
    container.innerHTML = emptyMessage
      ? `<span class="search-empty-state">${escapeHtml(emptyMessage)}</span>`
      : '';
    return;
  }
  container.innerHTML = `<span>즐겨찾기:</span>` + favorites.map((name) => `
    <span class="search-chip chip-with-remove" data-name="${escapeHtml(name)}">
      <button class="chip-label">★ ${escapeHtml(name)}</button>
      <button class="chip-compare" aria-label="${escapeHtml(name)} VS 비교" title="현재 검색 유저와 VS 비교">VS</button>
      <button class="chip-remove" aria-label="${escapeHtml(name)} 즐겨찾기 삭제" title="즐겨찾기 삭제">×</button>
    </span>
  `).join('');
  container.querySelectorAll('.chip-label').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.closest('.chip-with-remove')?.dataset.name;
      onSearch(name);
    });
  });
  container.querySelectorAll('.chip-remove').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const name = btn.closest('.chip-with-remove')?.dataset.name;
      if (name && typeof onRemove === 'function') onRemove(name);
    });
  });
  container.querySelectorAll('.chip-compare').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      const name = btn.closest('.chip-with-remove')?.dataset.name;
      if (name && typeof onCompare === 'function') onCompare(name);
    });
  });
}

/** Keep the public and league search favorite button presentation consistent. */
export function renderFavoriteSearchButton(button, favorite) {
  button.classList.remove('hidden');
  button.classList.toggle('favorite-active', favorite);
  button.textContent = favorite ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기 추가';
}
