import { getCurrentUser, getCurrentUserProfile, waitAuthReady, subscribeAuthState, requireAuth } from '../auth/infra/auth-gateway.js?v=512ed5fcfa8b';
import { createDashboardService } from './application/dashboard-service.js?v=1c4dc7acd285';
import { renderDashboardView } from './ui/dashboard-view.js?v=02c8ceaaa529';
import { createDashboardRepository, readBuildInfo } from './infra/dashboard-repository.js?v=af75ef458c82';
import { waitForFirestoreReady } from '../board/infra/firestore-ready.js?v=a4c0835eceb6';

const gate = document.getElementById('adminGate'), dashboard = document.getElementById('adminDashboard');
const content = document.getElementById('adminContent'), feedback = document.getElementById('adminFeedback');
const dialog = document.getElementById('applicationDecision');
let selection = null, repository = null, closing = false;
const validViews = ['overview', 'notices', 'applications', 'tools'];
const view = () => validViews.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
function setFeedback(message, error = false) {
  feedback.textContent = message; feedback.hidden = !message; feedback.setAttribute('role', error ? 'alert' : 'status');
}
function paint(state) {
  const allowed = state.access === 'admin';
  gate.hidden = allowed; dashboard.hidden = !allowed;
  if (!allowed) {
    content.replaceChildren();
    for (const id of ['decisionName','decisionOuid','decisionDescription']) document.getElementById(id).textContent = '';
    selection = null; if (dialog.open) dialog.close(); setFeedback('');
    document.getElementById('adminName').textContent = '';
    document.getElementById('adminGateTitle').textContent = state.access === 'checking' ? '관리자 권한 확인 중' : state.access === 'guest' ? '관리자 로그인 필요' : '관리자 전용 화면입니다';
    document.getElementById('adminGateMessage').textContent = state.access === 'guest' ? '사이트 관리자 계정으로 로그인해 주세요.' : state.access === 'denied' ? '현재 계정으로는 이 운영 화면을 사용할 수 없습니다.' : '로그인 상태와 관리자 권한을 확인하고 있습니다.';
    document.getElementById('adminLogin').hidden = state.access !== 'guest';
    return;
  }
  document.getElementById('adminName').textContent = state.name;
  document.querySelectorAll('[data-admin-nav]').forEach(a => { if (a.dataset.adminNav === view()) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  content.innerHTML = renderDashboardView(state, view());
  document.getElementById('decisionConfirm').disabled = Boolean(state.busyId);
  document.getElementById('decisionCancel').disabled = Boolean(state.busyId);
}
const service = createDashboardService({
  async getRepository() {
    if (!repository) { await waitForFirestoreReady(); repository = createDashboardRepository({ db: window.db, firebaseApp: window.firebase }); }
    return repository;
  }, getBuildInfo: () => readBuildInfo(), onChange: paint,
});
function loadView(force = false) {
  if (service.getState().access !== 'admin') return;
  paint(service.getState());
  const current = view();
  void (current === 'overview' ? service.loadOverview(force) : current === 'notices' ? service.loadNotices(force)
    : current === 'applications' ? service.loadApplications(force) : Promise.resolve()).catch(() => {});
}
function updateSession({ user, profile }) {
  if (closing) return;
  if (service.setSession(user, profile)) { selection = null; if (dialog.open) dialog.close(); loadView(); }
}
const unsubscribe = subscribeAuthState(updateSession);
void waitAuthReady().then(() => updateSession({ user: getCurrentUser(), profile: getCurrentUserProfile() }))
  .catch(() => updateSession({ user: null, profile: null }));
document.getElementById('adminLogin').addEventListener('click', () => { void requireAuth({ redirectTo: '/admin/' }); });
window.addEventListener('hashchange', () => { setFeedback(''); loadView(); });
content.addEventListener('click', event => {
  const button = event.target.closest('button'); if (!button || service.getState().access !== 'admin') return;
  if (button.hasAttribute('data-build')) { void service.loadBuild(true).catch(() => {}); return; }
  if (button.dataset.refresh) { setFeedback(''); if (button.dataset.refresh === view()) loadView(true); else void (button.dataset.refresh === 'notices' ? service.loadNotices(true) : service.loadApplications(true)).catch(() => {}); return; }
  if (button.dataset.decision) {
    const app = service.getState().applications.items.find(a => a.id === button.dataset.applicationId);
    if (!app || service.getState().busyId) return;
    selection = { id: app.id, decision: button.dataset.decision };
    document.getElementById('decisionTitle').textContent = selection.decision === 'APPROVED' ? '리그 신청 승인' : '리그 신청 반려';
    document.getElementById('decisionDescription').textContent = '아래 신청을 처리하시겠습니까?';
    document.getElementById('decisionName').textContent = app.characterName;
    document.getElementById('decisionOuid').textContent = app.ouid;
    document.getElementById('decisionConfirm').textContent = selection.decision === 'APPROVED' ? '승인 확인' : '반려 확인';
    dialog.showModal();
  }
});
document.getElementById('decisionCancel').addEventListener('click', () => { selection = null; dialog.close(); });
dialog.addEventListener('cancel', event => { if (service.getState().busyId) event.preventDefault(); else selection = null; });
document.getElementById('decisionConfirm').addEventListener('click', async () => {
  if (!selection || service.getState().busyId) return;
  const decision = selection;
  try {
    const result = await service.decideApplication(decision.id, decision.decision);
    if (service.getState().access !== 'admin' || selection !== decision) return;
    selection = null; dialog.close();
    setFeedback(result?.existingMember ? '기존 멤버 전적을 유지하고 신청을 승인했습니다.' : decision.decision === 'APPROVED' ? '리그 신청을 승인했습니다.' : '리그 신청을 반려했습니다.');
  } catch (error) {
    if (service.getState().access !== 'admin') return;
    selection = null; dialog.close();
    setFeedback(error.message === 'APPLICATION_ALREADY_PROCESSED' ? '이미 다른 곳에서 처리한 신청입니다. 목록을 갱신했습니다.' : '처리하지 못했습니다. 신청 상태와 관리자 권한을 확인한 뒤 다시 시도해 주세요.', true);
  }
});
window.addEventListener('pagehide', event => { if (!event.persisted) { closing = true; unsubscribe(); service.dispose(); if (dialog.open) dialog.close(); } });
