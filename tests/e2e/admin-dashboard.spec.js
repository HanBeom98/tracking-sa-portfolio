import { test, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:4173';
async function setup(page, { access = 'admin', theme = 'dark', delay = false } = {}) {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (['/common.js', '/firebase-config.js', '/auth/ui/auth-client.js', '/pwa-register.js', '/analytics-loader.js'].includes(url.pathname)) return route.fulfill({ contentType: 'text/javascript', body: '' });
    if (url.pathname === '/build.txt') return route.fulfill({ body: `commit=${'a'.repeat(40)}\nbuilt_at_utc=2026-10-29T00:00:00Z\n` });
    if (url.pathname.startsWith('/api/')) return route.abort();
    return route.continue();
  });
  await page.addInitScript(({ access, theme, delay }) => {
    localStorage.setItem('theme', theme);
    document.addEventListener('DOMContentLoaded', () => document.body.classList.toggle('dark-mode', theme === 'dark'));
    window.adminTest = { queries: [], decisions: 0, login: 0, hold: delay, fail: false, release: null };
    let listeners = [], user = access === 'guest' ? null : { uid: 'operator', email: access === 'admin' ? 'demo-9249b6f9@example.com' : access === 'league' ? 'demo-c9c4b555@example.com' : 'ordinary@example.test' };
    let profile = { uid: 'operator', nickname: 'Tracking', ...(access === 'role' ? { role: 'admin' } : {}) };
    window.AuthGateway = { waitForReady: async () => {}, getCurrentUser: () => user, getCurrentUserProfile: () => profile,
      subscribe(fn) { listeners.push(fn); return () => { listeners = listeners.filter(item => item !== fn); }; },
      requireAuth: async () => { window.adminTest.login++; },
    };
    window.adminTest.logout = () => { user = null; profile = null; listeners.forEach(fn => fn({ user, profile })); };
    const documents = new Map([
      ['sa_crew_applications/applicant', { applicantUid: 'applicant', characterName: '선수 <Tracking>', ouid: 'player-id', status: 'PENDING', appliedAt: Date.now() }],
      ['sa_crew_members/player-id', { characterName: 'OldName', wins: 15, mmr: 1550 }],
      ...Array.from({ length: 21 }, (_, i) => [`board_posts/notice-${i}`, { category: 'notice', title: `공지 ${i + 1} <script>`, createdAt: Date.now() - i * 1000 }]),
    ]);
    window.adminTest.documents = documents;
    const snapshot = path => ({ id: path.split('/').pop(), exists: documents.has(path), data: () => documents.get(path) });
    window.db = { collection(name) {
      let filter, size;
      const query = { where(...args) { filter = args; return query; }, orderBy() { return query; }, limit(value) { size = value; return query; },
        doc(id) { return { path: `${name}/${id}` }; },
        async get() {
          window.adminTest.queries.push({ name, size });
          if (window.adminTest.hold) await new Promise(resolve => { window.adminTest.release = resolve; });
          if (window.adminTest.fail) throw Error('permission-denied');
          return { docs: [...documents.entries()].filter(([path, data]) => path.startsWith(name + '/') && (!filter || data[filter[0]] === filter[2])).slice(0, size).map(([path]) => snapshot(path)) };
        },
      }; return query;
    }, async runTransaction(update) {
      const writes = [];
      const result = await update({ get: async ref => snapshot(ref.path), update: (ref, data) => writes.push([ref.path, { ...documents.get(ref.path), ...data }]), set: (ref, data) => writes.push([ref.path, data]) });
      writes.forEach(([path, data]) => documents.set(path, data)); window.adminTest.decisions++; return result;
    } };
    window.firebase = { firestore: { FieldValue: { serverTimestamp: () => Date.now() } } };
  }, { access, theme, delay });
}

for (const access of ['guest', 'member', 'league']) {
  test(`${access} cannot start dashboard reads`, async ({ page }) => {
    await setup(page, { access }); await page.goto('/admin/');
    await expect(page.locator('#adminGateTitle')).toHaveText(access === 'guest' ? '관리자 로그인 필요' : '관리자 전용 화면입니다');
    await expect(page.locator('#adminDashboard')).toBeHidden();
    expect(await page.evaluate(() => window.adminTest.queries)).toEqual([]);
    if (access === 'guest') { await page.locator('#adminLogin').click(); expect(await page.evaluate(() => window.adminTest.login)).toBe(1); }
  });
}

for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
  test(`admin workflow at ${width}px ${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 }); await setup(page, { theme });
    const errors = [], api = []; page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) api.push(request.url()); });
    await page.goto('/admin/');
    await expect(page.getByRole('heading', { name: '관리자 홈', exact: true })).toBeVisible();
    await expect(page.locator('.admin-list-row')).toHaveCount(4);
    expect(await page.evaluate(() => window.adminTest.queries)).toEqual([{ name: 'board_posts', size: 21 }, { name: 'sa_crew_applications', size: 21 }]);
    await expect(page.getByRole('link', { name: '＋ 공지 쓰기' })).toHaveAttribute('href', '/board/write?category=notice');
    await page.getByRole('button', { name: '배포 정보 확인 →' }).click();
    await expect(page.locator('.admin-build-value')).toHaveText('aaaaaaaa');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`admin-${width}-${theme}.png`), fullPage: true });
    await page.locator('[data-admin-nav="notices"]').click();
    await expect(page.locator('.admin-list-row')).toHaveCount(20);
    await expect(page.locator('.admin-muted')).toContainText('최근 20개');
    expect(await page.evaluate(() => window.adminTest.queries.length)).toBe(2);
    await page.locator('[data-admin-nav="applications"]').click();
    await expect(page.getByRole('heading', { name: '리그 신청', exact: true })).toHaveCount(1);
    await expect(page.locator('.admin-item-title')).toHaveText('선수 <Tracking>');
    await page.getByRole('button', { name: '승인', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('#decisionName')).toHaveText('선수 <Tracking>');
    await page.getByRole('button', { name: '취소', exact: true }).click();
    expect(await page.evaluate(() => window.adminTest.decisions)).toBe(0);
    await page.getByRole('button', { name: '승인', exact: true }).click();
    await page.getByRole('button', { name: '승인 확인' }).click();
    await expect(page.locator('#adminFeedback')).toContainText('기존 멤버 전적을 유지');
    await expect(page.locator('.admin-empty')).toHaveText('대기 중인 리그 신청이 없습니다.');
    expect(await page.evaluate(() => window.adminTest.documents.get('sa_crew_members/player-id').wins)).toBe(15);
    expect(await page.evaluate(() => window.adminTest.decisions)).toBe(1);
    expect(errors).toEqual([]); expect(api).toEqual([]);
  });
}

test('role admin is allowed; logout clears an open decision and private records', async ({ page }) => {
  await setup(page, { access: 'role' }); await page.goto('/admin/#applications');
  await page.getByRole('button', { name: '반려', exact: true }).click();
  await page.evaluate(() => window.adminTest.logout());
  await expect(page.locator('#adminGateTitle')).toHaveText('관리자 로그인 필요');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('#decisionName')).toBeEmpty(); await expect(page.locator('#adminContent')).toBeEmpty();
});

test('in-flight list cannot restore private data after logout', async ({ page }) => {
  await setup(page, { delay: true }); await page.goto('/admin/#applications');
  await expect.poll(() => page.evaluate(() => Boolean(window.adminTest.release))).toBe(true);
  await page.evaluate(() => { window.adminTest.logout(); window.adminTest.release(); });
  await expect(page.locator('#adminGateTitle')).toHaveText('관리자 로그인 필요');
  await expect(page.locator('#adminContent')).toBeEmpty();
});

test('failed lists show retry; explicit retry uses another bounded query', async ({ page }) => {
  await setup(page); await page.goto('/admin/#applications');
  await expect(page.locator('.admin-item-title')).toBeVisible();
  await page.evaluate(() => { window.adminTest.fail = true; });
  await page.getByRole('button', { name: '새로고침', exact: true }).click();
  await expect(page.locator('.admin-error')).toBeVisible();
  await page.evaluate(() => { window.adminTest.fail = false; });
  await page.getByRole('button', { name: '다시 불러오기' }).click();
  await expect(page.locator('.admin-item-title')).toBeVisible();
  expect(await page.evaluate(() => window.adminTest.queries.length)).toBe(3);
});

test('header admin entry follows site privileges and disappears on logout', async ({ page }, info) => {
  await setup(page, { access: 'guest' }); await page.goto('/admin/');
  await page.addScriptTag({ url: '/auth-controls.js' });
  await page.evaluate(() => {
    window.adminTest.controls = window.createAuthControlsController({ container: document.getElementById('auth-controls'), getCurrentUser: () => null });
    window.adminTest.controls.setUser({ uid: 'member', email: 'demo-c9c4b555@example.com' }, null);
  });
  await expect(page.locator('#auth-user')).toBeVisible(); await expect(page.locator('#auth-admin')).toBeHidden();
  await page.evaluate(() => window.adminTest.controls.setUser({ uid: 'admin' }, { uid: 'admin', role: 'admin', nickname: 'Tracking' }));
  await expect(page.locator('#auth-admin')).toBeVisible();
  await expect(page.locator('#auth-admin')).toHaveAttribute('href', '/admin/');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('#auth-admin').evaluate(el => { const rect = el.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth; })).toBe(true);
  await page.screenshot({ path: info.outputPath('admin-header-mobile.png') });
  await page.evaluate(() => { window.adminTest.controls.setUser({ uid: 'admin', email: 'demo-9249b6f9@example.com' }); window.adminTest.controls.setUser(null); });
  await expect(page.locator('#auth-admin')).toBeHidden();
});

test('nested login controls bypass an old unversioned script after a release', async ({ page }) => {
  await setup(page, { access: 'guest' });
  const controlsRequests = [];
  page.on('request', request => { const url = new URL(request.url()); if (url.pathname === '/auth-controls.js') controlsRequests.push(url.searchParams.get('v')); });
  // Reproduce a browser that can reuse a stale unversioned login control.
  await page.route('**/auth-controls.js', route => route.fulfill({ contentType: 'text/javascript', body: 'window.createAuthControlsController=()=>({setUser(){}});' }));
  await page.goto('/admin/');
  await page.addScriptTag({ url: '/auth-ui-controller.js' });
  await page.evaluate(async () => {
    const controls = window.createAuthUiController({ assetVersion: 'new-release', getCurrentUser: () => null });
    await controls.init();
    controls.updateUser({ uid: 'admin', email: 'demo-9249b6f9@example.com' }, { nickname: 'Tracking' });
  });
  await expect(page.locator('#auth-admin')).toBeVisible();
  expect(controlsRequests).toEqual(['new-release']);
});
