import { escapeHtml } from '../../shared/html.js?v=d181848c5b3c';
import { noticeDisplayState, homeNoticeCount, ADMIN_LIST_LIMIT } from '../domain/dashboard-policy.js?v=9b3b3d260aa2';

const date = value => {
  const ms = typeof value?.toMillis === 'function' ? value.toMillis() : value?.seconds ? value.seconds * 1000 : typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toLocaleString('ko-KR') : '날짜 확인 불가';
};
const noticeWrite = '<a class="admin-button admin-primary" href="/board/write?category=notice">＋ 공지 쓰기</a>';
const retry = kind => `<button type="button" data-refresh="${kind}">다시 불러오기</button>`;
function noticeRows(entry, now) {
  if (entry.status === 'error') return `<p class="admin-error">${escapeHtml(entry.error)}</p>${retry('notices')}`;
  if (entry.status !== 'ready') return '<p class="admin-empty">공지를 불러오는 중입니다…</p>';
  if (!entry.items.length) return '<p class="admin-empty">등록된 공지가 없습니다.</p>';
  return entry.items.map((n, i) => {
    const display = noticeDisplayState(n, now), visible = i < 5 && display.active;
    return `<div class="admin-list-row"><div><a class="admin-item-title" href="/board/post?id=${encodeURIComponent(n.id)}">${escapeHtml(n.title || '제목 없음')}</a><small>${escapeHtml(date(n.createdAt))}${display.expiresAt ? ` · 홈 표시 기한 ${escapeHtml(date(display.expiresAt))}` : ''}</small></div><div class="admin-actions"><span class="admin-badge ${visible ? 'is-active' : ''}">${visible ? '홈 표시 중' : display.active ? '최신 공지 우선 표시' : '홈 표시 종료'}</span><a class="admin-button" href="/board/edit?id=${encodeURIComponent(n.id)}">수정</a></div></div>`;
  }).join('') + (entry.hasMore ? `<p class="admin-muted">최근 ${ADMIN_LIST_LIMIT}개를 표시합니다. <a href="/board/?category=notice">공지 게시판 전체 보기 →</a></p>` : '');
}
function applicationRows(entry, busyId) {
  if (entry.status === 'error') return `<p class="admin-error">${escapeHtml(entry.error)}</p>${retry('applications')}`;
  if (entry.status !== 'ready') return '<p class="admin-empty">대기 신청을 불러오는 중입니다…</p>';
  if (!entry.items.length) return '<p class="admin-empty">대기 중인 리그 신청이 없습니다.</p>';
  return entry.items.map(a => `<div class="admin-list-row"><div><strong class="admin-item-title">${escapeHtml(a.characterName)}</strong><small>${escapeHtml(date(a.appliedAt))} · <a href="/stats/sudden-attack/?n=${encodeURIComponent(a.characterName)}" target="_blank" rel="noopener noreferrer">게임 전적 확인 ↗</a></small></div><div class="admin-actions"><button type="button" data-decision="APPROVED" data-application-id="${escapeHtml(a.id)}" ${busyId ? 'disabled' : ''}>승인</button><button type="button" data-decision="REJECTED" data-application-id="${escapeHtml(a.id)}" ${busyId ? 'disabled' : ''}>반려</button></div></div>`).join('')
    + (entry.hasMore ? `<p class="admin-muted">대기 신청 중 ${ADMIN_LIST_LIMIT}개를 표시합니다. <a href="/stats/sudden-attack/league/">리그 관리에서 나머지 확인 →</a></p>` : '');
}
const toolRows = () => `<div class="admin-tool-grid"><a class="admin-tool" href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer"><strong>Google Analytics ↗</strong><small>방문·사용 현황</small></a><a class="admin-tool" href="https://console.firebase.google.com/project/demo-tracking-sa-portfolio/overview" target="_blank" rel="noopener noreferrer"><strong>Firebase ↗</strong><small>인증·DB 관리</small></a><a class="admin-tool" href="https://dash.cloudflare.com/" target="_blank" rel="noopener noreferrer"><strong>Cloudflare ↗</strong><small>배포·도메인 관리</small></a></div>`;
function buildCard(build) {
  const title = build.status === 'loading' ? '확인 중…' : build.status === 'error' ? '확인 실패' : build.status === 'ready' ? build.info.commit === 'unknown' ? '빌드 번호 없음' : build.info.commit.slice(0, 8) : '확인 전';
  return `<span class="admin-stat-value admin-build-value">${escapeHtml(title)}</span><button type="button" class="admin-text-button" data-build ${build.status === 'loading' ? 'disabled' : ''}>배포 정보 확인 →</button>${build.info ? `<small>빌드 ${escapeHtml(date(build.info.builtAt))}</small>` : ''}`;
}
export function renderDashboardView(state, view, now = Date.now()) {
  const names = { overview: '관리자 홈', notices: '공지 관리', applications: '리그 신청', tools: '운영 바로가기' };
  const descriptions = { overview: '최근 공지와 처리할 신청을 한곳에서 확인하세요.', notices: '최근 공지와 홈 표시 상태를 확인하고 작성·수정합니다.', applications: '게임 전적과 신청 내용을 확인한 뒤 처리해 주세요.', tools: '기존 운영 도구와 배포 정보를 필요할 때 확인합니다.' };
  const currentEntry = state[view === 'applications' ? 'applications' : 'notices'];
  const loading = view === 'overview' ? state.notices.status === 'loading' || state.applications.status === 'loading' : currentEntry.status === 'loading';
  let html = `<div class="admin-heading"><div><h1>${names[view]}</h1><p>${descriptions[view]}</p></div><div class="admin-actions">${view !== 'tools' ? `<button type="button" data-refresh="${view}" ${loading || state.busyId ? 'disabled' : ''}>새로고침</button>` : ''}${['overview', 'notices'].includes(view) ? noticeWrite : ''}</div></div>`;
  if (view === 'overview') {
    const appCount = state.applications.status === 'ready' ? `${state.applications.items.length}${state.applications.hasMore ? '+' : ''}` : '—';
    const notices = state.notices.status === 'ready' ? homeNoticeCount(state.notices.items, now) : '—';
    html += `<div class="admin-summary"><article><span>처리할 리그 신청</span><strong class="admin-stat-value">${appCount}<small>건</small></strong><a href="#applications">신청 확인 →</a></article><article><span>홈 표시 공지</span><strong class="admin-stat-value">${notices}<small>건</small></strong><small>작성일부터 14일 · 최신 5개</small></article><article><span>현재 배포 정보</span>${buildCard(state.build)}</article></div>`;
    html += `<section class="admin-panel"><div class="admin-panel-heading"><h2>최근 공지</h2><a href="#notices">전체 보기 →</a></div>${noticeRows({ ...state.notices, items: state.notices.items.slice(0, 3), hasMore: false }, now)}</section><div class="admin-columns"><section class="admin-panel"><div class="admin-panel-heading"><h2>리그 신청</h2><a href="#applications">목록 보기 →</a></div>${applicationRows({ ...state.applications, items: state.applications.items.slice(0, 3), hasMore: false }, state.busyId)}</section><section class="admin-panel"><h2>운영 바로가기</h2>${toolRows()}</section></div>`;
  }
  if (view === 'notices') html += `<section class="admin-panel">${noticeRows(state.notices, now)}</section>`;
  if (view === 'applications') html += `<section class="admin-panel">${applicationRows(state.applications, state.busyId)}</section>`;
  if (view === 'tools') html += `<section class="admin-panel"><h2>자주 쓰는 운영 도구</h2>${toolRows()}</section><section class="admin-panel"><h2>사이트 배포 정보</h2>${buildCard(state.build)}</section>`;
  if (view !== 'tools' && currentEntry.loadedAt) html += `<p class="admin-last-read">마지막 조회 ${escapeHtml(date(currentEntry.loadedAt))}</p>`;
  return html;
}
