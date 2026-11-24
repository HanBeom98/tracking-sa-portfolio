import { isSiteAdministrator, ADMIN_LIST_LIMIT } from '../domain/dashboard-policy.js?v=9b3b3d260aa2';

const entry = () => ({ status: 'idle', items: [], hasMore: false, error: '', loadedAt: null, request: 0 });
export function createDashboardService({ getRepository, getBuildInfo, onChange = () => {}, now = Date.now }) {
  let revision = 0, sessionKey = '', disposed = false;
  let state = { access: 'checking', name: '', notices: entry(), applications: entry(), build: { status: 'idle', info: null }, busyId: null };
  const emit = () => { if (!disposed) onChange(state); };
  const assertAdmin = () => { if (disposed || state.access !== 'admin') throw new Error('ADMIN_REQUIRED'); };
  const current = version => !disposed && version === revision && state.access === 'admin';
  function setSession(user, profile) {
    const access = !user ? 'guest' : isSiteAdministrator(user, profile) ? 'admin' : 'denied';
    const key = `${user?.uid || ''}:${access}`;
    if (sessionKey === key) return false;
    sessionKey = key; revision++;
    state = { access, name: access === 'admin' ? String(profile?.nickname || user.displayName || '관리자') : '',
      notices: entry(), applications: entry(), build: { status: 'idle', info: null }, busyId: null };
    emit(); return true;
  }
  async function load(kind, force = false) {
    assertAdmin();
    const target = state[kind];
    if (!force && ['ready', 'loading'].includes(target.status)) return;
    const version = revision, request = ++target.request;
    target.status = 'loading'; target.error = ''; target.items = []; target.hasMore = false; emit();
    try {
      const repository = await getRepository();
      if (!current(version) || request !== target.request) return;
      const items = await (kind === 'notices' ? repository.listNotices() : repository.listApplications());
      if (!current(version) || request !== target.request) return;
      target.items = items.slice(0, ADMIN_LIST_LIMIT); target.hasMore = items.length > ADMIN_LIST_LIMIT;
      target.status = 'ready'; target.loadedAt = now(); emit();
    } catch {
      if (!current(version) || request !== target.request) return;
      target.status = 'error'; target.error = '목록을 불러오지 못했습니다. 권한과 연결 상태를 확인하고 다시 시도해 주세요.'; emit();
    }
  }
  async function loadBuild(force = false) {
    assertAdmin(); if (state.build.status === 'loading' || !force && state.build.status === 'ready') return;
    const version = revision, build = state.build;
    build.status = 'loading'; emit();
    try { const info = await getBuildInfo(); if (current(version) && state.build === build) { build.info = info; build.status = 'ready'; emit(); } }
    catch { if (current(version) && state.build === build) { build.info = null; build.status = 'error'; emit(); } }
  }
  async function decideApplication(id, decision) {
    assertAdmin();
    if (!['APPROVED', 'REJECTED'].includes(decision)) throw new Error('INVALID_DECISION');
    if (state.busyId) throw new Error('ACTION_PENDING');
    if (!state.applications.items.some(a => a.id === id && a.status === 'PENDING')) throw new Error('APPLICATION_NOT_FOUND');
    const version = revision; state.busyId = id; emit();
    try {
      const repository = await getRepository();
      if (!current(version)) throw new Error('ADMIN_REQUIRED');
      const result = await repository.decideApplication(id, decision);
      if (!current(version)) throw new Error('ADMIN_REQUIRED');
      await load('applications', true);
      return result;
    } catch (error) {
      if (current(version) && error.message === 'APPLICATION_ALREADY_PROCESSED') await load('applications', true);
      throw error;
    } finally { if (current(version)) { state.busyId = null; emit(); } }
  }
  return { getState: () => state, setSession, loadNotices: force => load('notices', force),
    loadApplications: force => load('applications', force), loadOverview: force => Promise.all([load('notices', force), load('applications', force)]),
    loadBuild, decideApplication, dispose() { disposed = true; revision++; state = { access: 'guest', notices: entry(), applications: entry(), build: { status: 'idle', info: null }, busyId: null }; } };
}
