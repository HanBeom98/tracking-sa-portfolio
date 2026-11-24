import { test, expect } from "@playwright/test";
import { resetEmulators, createAccount, installEmulatorBrowser, login, setNickname, writePost, readCollection, password, logout, firestoreBase } from "./emulator-browser.js";

test.beforeEach(async ({ context }) => {
  await resetEmulators();
  await installEmulatorBrowser(context);
});

test("site dashboard restores a real admin profile, processes an application and revokes on logout", async ({ page }) => {
  const admin = await createAccount("dashboard-admin", { admin: true });
  await login(page, admin);
  await setNickname(page, "사이트운영");
  await writePost(page, { category: "notice", title: "대시보드 공지" });
  await page.evaluate(async () => {
    await window.db.collection('sa_crew_members').doc('dashboard-player').set({ characterName: 'Original', wins: 17, loses: 8, mmr: 1640, previousNames: ['Disguise'] });
  });
  // Provision another user's pending application only in the fixed local demo.
  // Decisions below still use the real signed-in client and production rules.
  const seeded = await fetch(firestoreBase + '/sa_crew_applications/dashboard-applicant', {
    method: 'PATCH', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { applicantUid: { stringValue: 'dashboard-applicant' }, characterName: { stringValue: 'Disguise' },
      ouid: { stringValue: 'dashboard-player' }, status: { stringValue: 'PENDING' }, appliedAt: { timestampValue: new Date().toISOString() } } }),
  });
  expect(seeded.ok).toBe(true);
  await page.goto('/admin/');
  await expect(page.locator('#auth-admin')).toBeVisible();
  const commonVersion = new URL(await page.locator('script[src*="/common.js?v="]').getAttribute('src'), page.url()).searchParams.get('v');
  const controlsVersion = new URL(await page.locator('script[data-auth-controls="true"]').getAttribute('src'), page.url()).searchParams.get('v');
  expect(controlsVersion).toBe(commonVersion);
  await expect(page.getByRole('heading', { name: '관리자 홈', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '대시보드 공지', exact: true })).toBeVisible();
  await page.locator('[data-admin-nav="applications"]').click();
  await expect(page.getByRole('heading', { name: '리그 신청', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: '승인', exact: true }).click();
  await expect(page.locator('#decisionName')).toHaveText('Disguise');
  await page.getByRole('button', { name: '승인 확인' }).click();
  await expect(page.locator('#adminFeedback')).toContainText('기존 멤버 전적을 유지');
  const member = (await readCollection(page, 'sa_crew_members'))[0];
  expect(member.wins).toBe(17); expect(member.mmr).toBe(1640); expect(member.previousNames).toEqual(['Disguise']);
  expect((await readCollection(page, 'sa_crew_applications'))[0].status).toBe('APPROVED');
  await logout(page);
  await expect(page.locator('#adminGateTitle')).toHaveText('관리자 로그인 필요');
  await expect(page.locator('#adminContent')).toBeEmpty();
  await expect(page.locator('#auth-admin')).toBeHidden();
});

test("guest and wrong-password login cannot unlock writing; valid login still needs a nickname", async ({ page }) => {
  const account = await createAccount("guest-flow");
  await page.goto("/board/write/");
  await expect(page.locator("board-write-form")).toBeHidden();
  await page.locator("#board-write-login-btn").click();
  await page.locator("#inline-login-email").fill(account.email);
  await page.locator("#inline-login-password").fill("incorrect-password");
  await page.locator("#inline-login-email-submit").click();
  await expect(page.locator("#inline-login-error")).not.toHaveText("");
  await expect(page.locator("board-write-form")).toBeHidden();
  await page.locator("#inline-login-password").fill(password);
  await Promise.all([page.waitForNavigation({ waitUntil: "load" }), page.locator("#inline-login-email-submit").click()]);
  await expect(page.locator("#board-write-nickname-required")).toBeVisible();
  await expect(page.locator("#global-inline-login-modal")).not.toBeVisible();
  await expect(page.locator("board-write-form")).toBeHidden();
  await expect.poll(() => readCollection(page, "board_posts")).toEqual([]);
  await page.locator("#board-write-nickname-required a").click();
  await expect(page).toHaveURL(/\/account\/$/);
  await expect(page.locator("#nickname")).toBeVisible();
  await expect(page.locator("#global-inline-login-modal")).not.toBeVisible();
});

test("nickname save and normal post creation persist the canonical author without email", async ({ page }) => {
  const account = await createAccount("writer-flow");
  await login(page, account);
  await setNickname(page, "테스트회원");
  await page.reload();
  await expect(page.locator("#nickname")).toHaveValue("테스트회원");
  const post = await writePost(page);
  expect(post.authorUid).toBe(account.uid);
  expect(post.authorName).toBe("테스트회원");
  expect(post.category).toBe("free");
  expect(post.title).toBe("로컬 통합 검증");
  expect(post.content).toContain("테스트 내용");
  expect(post).not.toHaveProperty("authorEmail");
});

test("a saved session survives delayed profile loading without reopening login", async ({ page, context }) => {
  const account = await createAccount("restore-flow");
  await login(page, account);
  await setNickname(page, "복원회원");
  await context.addInitScript(() => {
    window.testLoginModalOpened = false;
    new MutationObserver(() => {
      if (document.querySelector("#global-inline-login-modal.open")) window.testLoginModalOpened = true;
    }).observe(document, { childList: true, attributes: true, subtree: true });
  });
  let delayed = false;
  await page.route("http://127.0.0.1:8085/**", async (route) => {
    if (!delayed) { delayed = true; await new Promise((resolve) => setTimeout(resolve, 750)); }
    await route.continue();
  });
  await page.goto("/board/write/");
  await expect(page.locator("board-write-form")).toBeVisible();
  await expect(page.locator("#board-write-login-required")).toHaveCount(0);
  expect(await page.evaluate(() => window.testLoginModalOpened)).toBe(false);
  expect(delayed).toBe(true);
  await expect(page.locator("board-write-form #category option[value=notice]")).toHaveCount(0);
});

test("logout revokes the open writer form and unauthenticated backend writes fail", async ({ page }) => {
  const account = await createAccount("logout-flow");
  await login(page, account);
  await setNickname(page, "로그아웃회원");
  await page.goto("/board/write/");
  await expect(page.locator("board-write-form")).toBeVisible();
  await page.evaluate((uid) => { window.testPreviousUid = uid; }, account.uid);
  await logout(page);
  await expect(page.locator("#board-write-login-required")).toBeVisible();
  await expect(page.locator("board-write-form")).toBeHidden();
  const code = await page.evaluate(async () => {
    try {
      await window.db.collection("board_posts").add({ title: "forged", content: "forged", authorUid: window.testPreviousUid, authorName: "로그아웃회원", authorPhoto: "", category: "free", attachments: [], createdAt: window.firebase.firestore.FieldValue.serverTimestamp() });
      return "unexpected-success";
    } catch (error) { return error.code; }
  });
  expect(code).toBe("permission-denied");
  expect(await readCollection(page, "board_posts")).toEqual([]);
});

test("ordinary members cannot create notices; admins still need a nickname before notice creation", async ({ page }) => {
  const member = await createAccount("member-flow");
  await login(page, member);
  await setNickname(page, "일반회원");
  const denied = await page.evaluate(async () => {
    try {
      await window.db.collection("board_posts").add({ title: "forged notice", content: "forged notice", authorUid: window.auth.currentUser.uid, authorName: "일반회원", authorPhoto: "", category: "notice", attachments: [], createdAt: window.firebase.firestore.FieldValue.serverTimestamp() });
      return "unexpected-success";
    } catch (error) { return error.code; }
  });
  expect(denied).toBe("permission-denied");
  await logout(page);
  const admin = await createAccount("admin-flow", { admin: true });
  await login(page, admin);
  await page.goto("/board/write/?category=notice");
  await expect(page.locator("#board-write-nickname-required")).toBeVisible();
  await setNickname(page, "운영회원");
  const post = await writePost(page, { category: "notice", title: "로컬 공지 검증" });
  expect(post.category).toBe("notice");
  expect(post.authorUid).toBe(admin.uid);
  expect(post.authorName).toBe("운영회원");
  expect(post).not.toHaveProperty("authorEmail");
});

test("nickname-less readers can set a nickname then submit a comment using their own identity", async ({ page }) => {
  const author = await createAccount("comment-author");
  await login(page, author);
  await setNickname(page, "글작성회원");
  const post = await writePost(page);
  await logout(page);
  const reader = await createAccount("comment-reader");
  await login(page, reader);
  await page.goto("/board/post/?id=" + post.id);
  const comments = page.locator("board-comments");
  await expect(comments.getByText("닉네임 설정하기")).toBeVisible();
  await expect(comments.locator("textarea")).toHaveCount(0);
  await comments.getByText("닉네임 설정하기").click();
  await expect(page).toHaveURL(/\/account\/$/);
  await expect(page.locator("#nickname")).toBeVisible();
  await expect(page.locator("#global-inline-login-modal")).not.toBeVisible();
  await setNickname(page, "댓글회원");
  await page.goto("/board/post/?id=" + post.id);
  await comments.getByRole("textbox", { name: "댓글 내용" }).fill("실제 SDK 댓글 검증");
  await comments.locator(".composer .submit").click();
  await expect(comments.getByText("실제 SDK 댓글 검증")).toBeVisible();
  const saved = await readCollection(page, "board_posts/" + post.id + "/comments");
  expect(saved).toHaveLength(1);
  expect(saved[0].authorUid).toBe(reader.uid);
  expect(saved[0].authorName).toBe("댓글회원");
  expect(saved[0]).not.toHaveProperty("authorEmail");
});

test("blocked session storage still permits real email login, nickname setup and writing", async ({ page, context }) => {
  const account = await createAccount("session-storage-blocked");
  await context.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", { configurable: true,
      get() { throw new DOMException("Session storage blocked", "SecurityError"); },
    });
  });
  await login(page, account);
  await setNickname(page, "임시저장회원");
  const post = await writePost(page, { title: "세션 저장소 차단 검증" });
  expect(post.authorUid).toBe(account.uid);
  expect(post.authorName).toBe("임시저장회원");
  expect(post.title).toBe("세션 저장소 차단 검증");
  expect(post).not.toHaveProperty("authorEmail");
});

test("image cleanup retries transient failures, confirms missing objects and reports real Storage denial", async ({ page }) => {
  const account = await createAccount("image-cleanup");
  await login(page, account);
  await page.addScriptTag({ url: "https://www.gstatic.com/firebasejs/8.10.1/firebase-storage.js" });
  const outcome = await page.evaluate(async ({ uid, email, password }) => {
    const service = await import('/board/infra/board-image-service.js');
    const storage = window.firebase.storage();
    storage.useEmulator('127.0.0.1', 9198);
    const path = `board-images/${uid}/retry.webp`;
    const deniedPath = `board-images/${uid}/denied.webp`;
    const missingPath = `board-images/${uid}/missing.webp`;
    const metadata = { contentType: 'image/webp', customMetadata: { ownerUid: uid } };
    for (const target of [path, deniedPath]) await storage.ref(target).put(new Blob(['local-image']), metadata);
    const calls = [];
    const result = await service.deleteBoardImages([path, missingPath, 'board-images/foreign/private.webp'], {
      ownerUid: uid, storage: { ref: (target) => ({ delete: async () => {
        calls.push(target);
        if (target === path && calls.filter((item) => item === path).length === 1) {
          throw Object.assign(new Error('temporary disconnect'), { code: 'storage/network-request-failed' });
        }
        return storage.ref(target).delete();
      } }) },
    });
    let removedCode;
    try { await storage.ref(path).getMetadata(); } catch (error) { removedCode = error.code; }
    await window.auth.signOut();
    const denied = await service.deleteBoardImages([deniedPath], { ownerUid: uid, storage });
    await window.auth.signInWithEmailAndPassword(email, password);
    const retained = (await storage.ref(deniedPath).getMetadata()).fullPath;
    await storage.ref(deniedPath).delete();
    return { result, calls, path, missingPath, denied, retained, deniedPath, removedCode };
  }, { ...account, password });
  expect(outcome.result.deletedPaths).toEqual([outcome.path]);
  expect(outcome.result.missingPaths).toEqual([outcome.missingPath]);
  expect(outcome.result.skippedPaths).toEqual(['board-images/foreign/private.webp']);
  expect(outcome.result.failed).toEqual([]);
  expect(outcome.calls.filter((path) => path === outcome.path)).toHaveLength(2);
  expect(outcome.removedCode).toBe('storage/object-not-found');
  expect(outcome.denied.failed).toHaveLength(1);
  expect(outcome.denied.failed[0]).toMatchObject({ path: outcome.deniedPath, code: 'storage/unauthorized', attempts: 1 });
  expect(outcome.retained).toBe(outcome.deniedPath);
});

test("shared auth updates comment access on logout and account access on the next page", async ({ page }) => {
  const account = await createAccount("shared-comment-auth");
  await login(page, account);
  await setNickname(page, "상태공유회원");
  const post = await writePost(page);
  await page.goto('/board/post/?id=' + post.id);
  const comments = page.locator('board-comments');
  await expect(comments.getByRole('textbox', { name: '댓글 내용' })).toBeVisible();
  await logout(page);
  await expect(comments.getByRole('textbox', { name: '댓글 내용' })).toHaveCount(0);
  await expect(comments.locator('button.login')).toBeVisible();
  await page.goto('/account/');
  await expect(page.locator('#account-login-btn')).toBeVisible();
  await expect(page.locator('#nickname')).toHaveCount(0);
  expect(await readCollection(page, 'board_posts')).toHaveLength(1);
});

test("league staff access uses the shared restored session and revokes on logout", async ({ page }) => {
  // This email belongs only to a disposable account in the fixed loopback demo project.
  const staff = await createAccount('league-staff', { admin: true, email: 'demo-9249b6f9@example.com' });
  await login(page, staff);
  await page.goto('/stats/sudden-attack/league/');
  await expect(page.locator('#adminMenuBtn')).toBeVisible();
  await logout(page);
  await expect(page.locator('#adminMenuBtn')).toBeHidden();
  const user = await page.evaluate(async () => (await import('/auth/infra/auth-gateway.js')).getCurrentUser());
  expect(user).toBeNull();
  expect(await readCollection(page, 'sa_crew_history')).toEqual([]);
});

test("notice creation, editing and deletion refresh the real home banner without stale cache", async ({ page }) => {
  const admin = await createAccount('notice-cache-policy', { admin: true });
  await login(page, admin);
  await setNickname(page, '공지정책회원');
  const post = await writePost(page, { category: 'notice', title: '로컬 공지 정책 검증' });
  await page.goto('/');
  await expect(page.locator('[data-home-notice-text]')).toHaveText('로컬 공지 정책 검증');
  expect(await page.evaluate(() => localStorage.getItem('home-notices:v1:demo-trackingsa-ownership'))).not.toBeNull();

  await page.goto('/board/edit/?id=' + post.id);
  await page.locator('board-edit-form #title').fill('수정된 공지 정책 검증');
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('board-edit-form #submit-button').click();
  await page.waitForURL((url) => url.pathname === '/board/post');
  expect(await page.evaluate(() => localStorage.getItem('home-notices:v1:demo-trackingsa-ownership'))).toBeNull();
  await page.goto('/');
  await expect(page.locator('[data-home-notice-text]')).toHaveText('수정된 공지 정책 검증');

  await page.goto('/board/post/?id=' + post.id);
  const accept = (dialog) => dialog.accept();
  page.on('dialog', accept);
  await page.locator('board-post-view #delete-button').click();
  await page.waitForURL((url) => url.pathname === '/board');
  page.off('dialog', accept);
  expect(await page.evaluate(() => localStorage.getItem('home-notices:v1:demo-trackingsa-ownership'))).toBeNull();
  await page.goto('/');
  await expect.poll(() => readCollection(page, 'board_posts')).toEqual([]);
  await expect(page.locator('[data-home-notices]')).toBeHidden();
});
