import test from 'node:test';
import assert from 'node:assert/strict';
import { isSiteAdministrator, noticeDisplayState, homeNoticeCount, parseBuildInfo } from '../../src/domains/admin/domain/dashboard-policy.js';
import { createDashboardService } from '../../src/domains/admin/application/dashboard-service.js';
import { renderDashboardView } from '../../src/domains/admin/ui/dashboard-view.js';
import { createDashboardRepository, readBuildInfo } from '../../src/domains/admin/infra/dashboard-repository.js';

const admin = { uid: 'admin', email: 'demo-9249b6f9@example.com' };
const pending = { id: 'applicant', characterName: 'Tracking', ouid: 'stable-ouid', status: 'PENDING' };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function fixture(overrides = {}) {
  const calls = { repo: 0, notices: 0, applications: 0, build: 0, decisions: [] };
  const repository = {
    async listNotices() { calls.notices++; return []; },
    async listApplications() { calls.applications++; return [pending]; },
    async decideApplication(...args) { calls.decisions.push(args); return { existingMember: true }; }, ...overrides,
  };
  const service = createDashboardService({ getRepository: async () => { calls.repo++; return repository; },
    getBuildInfo: async () => { calls.build++; return { commit: 'a'.repeat(40), builtAt: '2026-10-29T00:00:00.000Z' }; }, now: () => 100 });
  return { service, calls, repository };
}

test('site administration excludes league-only staff and profiles from a different account', () => {
  assert.equal(isSiteAdministrator(null, { role: 'admin' }), false);
  assert.equal(isSiteAdministrator({ email: admin.email }, null), false);
  assert.equal(isSiteAdministrator(admin), true);
  assert.equal(isSiteAdministrator({ uid: 'league', email: 'demo-c9c4b555@example.com' }), false);
  assert.equal(isSiteAdministrator({ uid: 'role' }, { uid: 'role', role: 'admin' }), true);
  assert.equal(isSiteAdministrator({ uid: 'role' }, { uid: 'someone-else', role: 'admin' }), false);
});

test('guest and ordinary accounts start no repository or build queries', async () => {
  const { service, calls } = fixture();
  for (const user of [null, { uid: 'member' }, { uid: 'league', email: 'demo-c9c4b555@example.com' }]) {
    service.setSession(user, null);
    await assert.rejects(service.loadOverview(), /ADMIN_REQUIRED/);
    await assert.rejects(service.loadBuild(), /ADMIN_REQUIRED/);
    await assert.rejects(service.decideApplication('applicant', 'APPROVED'), /ADMIN_REQUIRED/);
  }
  assert.equal(calls.repo, 0); assert.equal(calls.build, 0);
});

test('bounded lists are cached across views; only explicit refresh reads again', async () => {
  const { service, calls } = fixture({ async listNotices() { calls.notices++; return Array.from({ length: 21 }, (_, i) => ({ id: String(i) })); } });
  service.setSession(admin);
  await service.loadOverview(); await service.loadOverview();
  assert.equal(calls.notices, 1); assert.equal(calls.applications, 1); assert.equal(calls.build, 0);
  assert.equal(service.getState().notices.items.length, 20); assert.equal(service.getState().notices.hasMore, true);
  assert.equal(service.getState().notices.loadedAt, 100);
  await service.loadNotices(true); assert.equal(calls.notices, 2);
  await service.loadBuild(); await service.loadBuild(); assert.equal(calls.build, 1);
});

test('logout and account switching discard in-flight private records and cached data', async () => {
  const waiting = deferred();
  const { service } = fixture({ listNotices: () => waiting.promise });
  service.setSession(admin); const loading = service.loadNotices();
  await Promise.resolve(); service.setSession(null);
  waiting.resolve([{ id: 'private', title: 'private' }]); await loading;
  assert.equal(service.getState().access, 'guest'); assert.deepEqual(service.getState().notices.items, []);
  service.setSession(admin); await service.loadApplications();
  service.setSession({ uid: 'other' }, { role: 'admin' });
  assert.deepEqual(service.getState().applications.items, []);
});

test('failed reads remain unknown rather than reporting zero applications', async () => {
  const { service } = fixture({ async listApplications() { throw Error('permission denied'); } });
  service.setSession(admin); await service.loadOverview();
  assert.equal(service.getState().applications.status, 'error');
  const html = renderDashboardView(service.getState(), 'overview');
  assert.match(html, /권한과 연결/); assert.match(html, /—<small>건/);
});

test('decisions require a loaded pending record, block duplicate clicks and refresh after success', async () => {
  const waiting = deferred();
  const { service, calls } = fixture({ decideApplication: async (...args) => { calls.decisions.push(args); return waiting.promise; } });
  service.setSession(admin); await service.loadApplications();
  await assert.rejects(service.decideApplication('wrong', 'APPROVED'), /APPLICATION_NOT_FOUND/);
  await assert.rejects(service.decideApplication('applicant', 'UNKNOWN'), /INVALID_DECISION/);
  const deciding = service.decideApplication('applicant', 'APPROVED');
  await assert.rejects(service.decideApplication('applicant', 'REJECTED'), /ACTION_PENDING/);
  waiting.resolve({ existingMember: true }); await deciding;
  assert.deepEqual(calls.decisions, [['applicant', 'APPROVED']]);
  assert.equal(calls.applications, 2); assert.equal(service.getState().busyId, null);
});

test('decision completion after logout cannot return success or restore private records', async () => {
  const waiting = deferred(); const { service } = fixture({ decideApplication: () => waiting.promise });
  service.setSession(admin); await service.loadApplications();
  const deciding = service.decideApplication('applicant', 'APPROVED'); await Promise.resolve();
  service.setSession(null); waiting.resolve({}); await assert.rejects(deciding, /ADMIN_REQUIRED/);
  assert.equal(service.getState().access, 'guest'); assert.deepEqual(service.getState().applications.items, []);
});

test('already processed decisions refresh the stale pending list', async () => {
  const { service, calls } = fixture({ async decideApplication() { throw Error('APPLICATION_ALREADY_PROCESSED'); } });
  service.setSession(admin); await service.loadApplications();
  await assert.rejects(service.decideApplication('applicant', 'REJECTED'), /ALREADY_PROCESSED/);
  assert.equal(calls.applications, 2); assert.equal(service.getState().busyId, null);
});

test('home notices use the existing 14-day and latest-five policy', () => {
  const start = Date.parse('2026-10-01T00:00:00Z'), end = start + 14 * 86400000;
  assert.equal(noticeDisplayState({ createdAt: start }, end - 1).active, true);
  assert.equal(noticeDisplayState({ createdAt: start }, end).active, false);
  assert.equal(noticeDisplayState({ createdAt: null }).expiresAt, null);
  assert.equal(homeNoticeCount(Array.from({ length: 7 }, () => ({ createdAt: start })), start), 5);
});

test('build info rejects invalid payloads and reads only the static artifact', async () => {
  const body = `commit=${'a'.repeat(40)}\nbuilt_at_utc=2026-10-29T00:00:00Z\n`;
  assert.equal(parseBuildInfo(body).commit, 'a'.repeat(40));
  for (const value of ['', 'commit=broken\nbuilt_at_utc=today', '<html>offline</html>']) assert.throws(() => parseBuildInfo(value));
  await readBuildInfo(async (url, options) => { assert.equal(url, '/build.txt'); assert.equal(options.cache, 'no-store'); return { ok: true, text: async () => body }; });
  await assert.rejects(readBuildInfo(async () => ({ ok: false })), /BUILD_INFO_UNAVAILABLE/);
});

test('record content is escaped and only existing notice routes are linked', async () => {
  const { service } = fixture({ async listNotices() { return [{ id: 'a&b', title: '<img src=x onerror=alert(1)>', createdAt: 0 }]; } });
  service.setSession(admin); await service.loadOverview();
  const html = renderDashboardView(service.getState(), 'notices');
  assert.ok(!html.includes('<img')); assert.match(html, /&lt;img/);
  assert.match(html, /\/board\/edit\?id=a%26b/); assert.match(html, /\/board\/write\?category=notice/);
});

test('repository bounds each query to 21 and projects only dashboard fields', async () => {
  const queries = []; let current;
  const db = { collection(name) { current = { name }; queries.push(current); const query = {
    where(field, op, value) { current.filter = [field, op, value]; return query; },
    orderBy(...args) { current.sort = args; return query; }, limit(value) { current.limit = value; return query; },
    async get() { return { docs: [{ id: 'record', data: () => ({ id: 'forged-id', title: 'Notice', characterName: 'Name', status: 'PENDING', privateField: 'omitted' }) }] }; },
  }; return query; } };
  const repo = createDashboardRepository({ db, firebaseApp: {} });
  assert.equal((await repo.listNotices())[0].privateField, undefined);
  const applications = await repo.listApplications();
  assert.equal(applications[0].privateField, undefined);
  assert.equal(applications[0].id, 'record');
  assert.deepEqual(queries.map(q => [q.name, q.limit, q.filter]), [
    ['board_posts', 21, ['category', '==', 'notice']], ['sa_crew_applications', 21, ['status', '==', 'PENDING']],
  ]);
});
