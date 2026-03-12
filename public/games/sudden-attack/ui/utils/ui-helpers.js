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
export function updateSwrUI(swrStatus, type, timestamp = null) {
  if (!swrStatus) return;

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
      swrStatus.classList.add('hidden-out');
      setTimeout(() => {
        swrStatus.classList.add('hidden');
        swrStatus.classList.remove('hidden-out');
      }, 500);
    }, 3000);
  } else {
    swrStatus.classList.add('hidden');
  }
}

/**
 * Recent Search Management
 */
export function getRecentSearches(storageKey) {
  const data = localStorage.getItem(storageKey);
  return data ? JSON.parse(data) : [];
}

export function saveSearch(storageKey, name) {
  let searches = getRecentSearches(storageKey);
  searches = [name, ...searches.filter(s => s !== name)].slice(0, 5);
  localStorage.setItem(storageKey, JSON.stringify(searches));
}

export function clearRecentSearches(storageKey) {
  localStorage.removeItem(storageKey);
}

export function getFavoriteSearches(storageKey) {
  const data = localStorage.getItem(storageKey);
  return data ? JSON.parse(data) : [];
}

export function isFavoriteSearch(storageKey, name) {
  return getFavoriteSearches(storageKey).includes(name);
}

export function toggleFavoriteSearch(storageKey, name) {
  const favorites = getFavoriteSearches(storageKey);
  const exists = favorites.includes(name);
  const next = exists
    ? favorites.filter((item) => item !== name)
    : [name, ...favorites.filter((item) => item !== name)].slice(0, 8);
  localStorage.setItem(storageKey, JSON.stringify(next));
  return !exists;
}

export function removeFavoriteSearch(storageKey, name) {
  const favorites = getFavoriteSearches(storageKey).filter((item) => item !== name);
  localStorage.setItem(storageKey, JSON.stringify(favorites));
}

export function renderRecentSearches(container, storageKey, onSearch, onClear = null) {
  if (!container) return;
  const searches = getRecentSearches(storageKey);
  if (searches.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML =
    `<span>최근 검색:</span>` +
    searches.map((s) => `<button class="search-chip">${s}</button>`).join('') +
    `<button class="chip-action-btn" data-action="clear">전체 비우기</button>`;
  container.querySelectorAll('.search-chip').forEach(btn => {
    btn.addEventListener('click', () => { onSearch(btn.textContent); });
  });
  const clearBtn = container.querySelector('[data-action="clear"]');
  if (clearBtn && typeof onClear === 'function') {
    clearBtn.addEventListener('click', onClear);
  }
}

export function renderFavoriteSearches(container, storageKey, onSearch, onRemove = null, onCompare = null) {
  if (!container) return;
  const favorites = getFavoriteSearches(storageKey);
  if (favorites.length === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `<span>즐겨찾기:</span>` + favorites.map((name) => `
    <span class="search-chip chip-with-remove" data-name="${name}">
      <button class="chip-label">★ ${name}</button>
      <button class="chip-compare" aria-label="${name} VS 비교" title="현재 검색 유저와 VS 비교">VS</button>
      <button class="chip-remove" aria-label="${name} 즐겨찾기 삭제" title="즐겨찾기 삭제">×</button>
    </span>
  `).join('');
  container.querySelectorAll('.chip-label').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.textContent.replace(/^★\s*/, '').trim();
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
