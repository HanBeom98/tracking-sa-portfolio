import { resolveMatchQueryMessage } from '../../application/search-error-messages.js?v=35de87a25884';
import { escapeHtml } from '../../../../shared/html.js?v=d181848c5b3c';
import { getSeasonView } from './public-search-presenters.js?v=6d52849561d9';

export async function runMatchCategoryTransition({ load, setPending, render, isCurrent = () => true }) {
  setPending(true);
  let profile;
  try {
    profile = await load();
  } catch (error) {
    if (!isCurrent()) return null;
    setPending(false);
    throw error;
  }
  if (!isCurrent()) return null;
  setPending(false);
  if (profile) render(profile);
  return profile;
}

export function createPublicMatchHistory({
  historySection, getActiveMatchCategory, getActiveSeasonMode,
  onMatchCategoryChange, onLoadMoreMatches, renderProfile
}) {
  let pendingMatchCategory = null;
  let loadingMoreMatches = false;
  let viewVersion = 0;

  function invalidatePendingMatches() {
    viewVersion += 1;
    pendingMatchCategory = null;
    loadingMoreMatches = false;
  }

  const matchCategories = [
    { key: 'all', label: '전체' },
    { key: 'solo', label: '솔로랭크' },
    { key: 'party', label: '파티랭크' },
    { key: 'clan', label: '클랜전' }
  ];

  function getActiveMatchView(profile) {
    const category = getActiveMatchCategory();
    if (category === 'all') return getSeasonView(profile, getActiveSeasonMode());
    return profile?.matchCategoryViews?.[category] || null;
  }

  function renderMatchCategoryTabs(profile) {
    const activeCategory = getActiveMatchCategory();
    return `
      <div class="match-category-bar" role="tablist" aria-label="매치 기록 유형">
        ${matchCategories.map(({ key, label }) => {
          const isActive = key === activeCategory;
          const cachedCount = profile?.matchCategoryHistory?.[key]?.matches?.length ?? (key === 'all'
            ? getSeasonView(profile, 'current')?.matches?.length
            : profile?.matchCategoryViews?.[key]?.matches?.length);
          const count = Number.isFinite(cachedCount) ? `<span>${cachedCount}</span>` : '';
          return `<button type="button" class="match-category-btn ${isActive ? 'active' : ''}" data-category="${key}" role="tab" aria-selected="${isActive}" ${pendingMatchCategory ? 'disabled' : ''}>${label}${count}</button>`;
        }).join('')}
      </div>
    `;
  }

  function bindMatchCategoryTabs() {
    historySection.querySelectorAll('.match-category-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        const category = button.dataset.category;
        if (!category || category === getActiveMatchCategory() || pendingMatchCategory || typeof onMatchCategoryChange !== 'function') return;
        const version = viewVersion;
        try {
          await runMatchCategoryTransition({
            isCurrent: () => viewVersion === version,
            load: () => onMatchCategoryChange(category),
            setPending: (pending) => {
              pendingMatchCategory = pending ? category : null;
              historySection.querySelectorAll('.match-category-btn').forEach((item) => {
                item.disabled = pending;
                item.classList.toggle('loading', pending && item === button);
              });
            },
            render: (profile) => renderProfile(profile)
          });
        } catch (error) {
          console.error('[SA Home] Match category load failed:', error);
          const notice = historySection.querySelector('.match-query-notice');
          if (notice) notice.textContent = resolveMatchQueryMessage(error, '선택한 경기 기록을 불러오지 못했습니다.');
        }
      });
    });
  }

  function getMatchHistory(profile, category, view) {
    return profile?.matchCategoryHistory?.[category] || { matches: view?.matches || [], hasMore: true };
  }

  function bindMatchHistoryMore(profile, category, history) {
    const button = historySection.querySelector('.match-history-more-btn');
    if (!button || typeof onLoadMoreMatches !== 'function') return;
    button.addEventListener('click', async () => {
      if (loadingMoreMatches) return;
      const version = viewVersion;
      loadingMoreMatches = true;
      button.disabled = true;
      button.textContent = '이전 경기를 불러오는 중...';
      try {
        const result = await onLoadMoreMatches(category, history.matches);
        if (viewVersion !== version) return;
        const seen = new Set(history.matches.map((match) => match.matchId));
        const appended = (result?.matches || []).filter((match) => match.matchId && !seen.has(match.matchId));
        profile.matchCategoryHistory = {
          ...(profile.matchCategoryHistory || {}),
          [category]: { matches: [...history.matches, ...appended], hasMore: Boolean(result?.hasMore) && appended.length > 0 }
        };
        renderProfile(profile);
      } catch (error) {
        if (viewVersion !== version) return;
        console.error('[SA Home] Older match load failed:', error);
        button.disabled = false;
        button.textContent = '불러오지 못했습니다 · 다시 시도';
        const notice = historySection.querySelector('.match-query-notice');
        if (notice) notice.textContent = resolveMatchQueryMessage(error, '이전 경기 기록을 불러오지 못했습니다.');
      } finally {
        if (viewVersion === version) loadingMoreMatches = false;
      }
    });
  }

  function render(profile, category, view, seasonLabel) {
    const matchHistory = getMatchHistory(profile, category, view);
    historySection.innerHTML = `
      <style>
        .match-category-bar { display:flex; gap:8px; flex-wrap:wrap; margin:0 0 18px; padding-bottom:12px; border-bottom:1px solid var(--sa-line-soft); }
        .match-category-btn { display:inline-flex; align-items:center; gap:6px; min-height:40px; padding:9px 15px; border:1px solid var(--sa-line-strong); border-radius:999px; background:var(--bg-card); color:var(--text-dim); font:inherit; font-size:13px; font-weight:800; cursor:pointer; transition:background .2s,border-color .2s,color .2s; }
        .match-category-btn:hover { border-color:var(--primary); color:var(--sa-text-strong); }
        .match-category-btn.active { border-color:var(--primary); background:var(--primary); color:#fff; }
        .match-category-btn span { min-width:20px; padding:2px 6px; border-radius:999px; background:rgba(255,255,255,.14); font-size:11px; text-align:center; }
        .match-category-btn.loading { opacity:.65; cursor:wait; }
        .match-category-btn:disabled { cursor:wait; }
        .match-history-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
        .match-history-heading h2 { margin:0; }
        .match-history-heading span { color:var(--text-dim); font-size:12px; }
        .match-query-notice { color:var(--sa-text-strong); font-size:13px; line-height:1.6; }
        .match-query-notice:empty { display:none; }
        .match-history-scope { margin:0 0 14px; color:var(--text-dim); font-size:12px; line-height:1.6; }
        .match-history-more { display:flex; justify-content:center; margin-top:18px; }
        .match-history-more-btn { min-height:44px; padding:0 22px; border:1px solid var(--sa-line-strong); border-radius:999px; background:var(--bg-card); color:var(--sa-text-strong); font:inherit; font-size:13px; font-weight:850; cursor:pointer; }
        .match-history-more-btn:hover { border-color:var(--primary); box-shadow:var(--sa-shadow); }
        .match-history-more-btn:disabled { opacity:.65; cursor:wait; }
        @media (max-width:640px) { .match-category-bar { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); } .match-category-btn { justify-content:center; padding-inline:10px; } }
      </style>
      ${renderMatchCategoryTabs(profile)}
      <div class="match-history-heading"><h2>${escapeHtml(seasonLabel)} 매치 기록</h2><span>최신순 · ${matchHistory.matches.length}경기 표시 중</span></div>
      <p class="match-history-scope">경기 유형별 최근 최대 1,000경기 범위에서 조회합니다.</p>
      <p class="match-query-notice" role="status" aria-live="polite"></p>
      <sa-match-list></sa-match-list>
      ${matchHistory.hasMore ? '<div class="match-history-more"><button type="button" class="match-history-more-btn">이전 경기 20개 더보기</button></div>' : '<div class="match-history-more"><span>조회 가능한 이전 경기 기록을 모두 표시했습니다.</span></div>'}
    `;
    const matchList = historySection.querySelector('sa-match-list');
    matchList.remotePagination = true;
    matchList.matchRecords = matchHistory.matches.map((match) => ({
      ...match,
      context: 'public'
    }));
    bindMatchCategoryTabs();
    bindMatchHistoryMore(profile, category, matchHistory);
    historySection.classList.remove('hidden');
  }

  return { getActiveMatchView, invalidatePendingMatches, render };
}
