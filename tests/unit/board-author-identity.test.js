import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { getBoardNickname } from '../../src/domains/board/domain/author-identity.js';
import { buildPostService } from '../../src/domains/board/application/postService.js';
import { buildCommentService } from '../../src/domains/board/application/commentService.js';
import { createSubmitPostUseCase } from '../../src/domains/board/application/submit-post-use-case.js';
import { renderWriteAccess } from '../../src/domains/board/ui/write-access-renderer.js';
import { escapeHtml } from '../../src/domains/board/domain/html.js';
import { createPrivacyClient } from '../../scripts/migrate-board-privacy.mjs';

test('displayName and email cannot substitute for a registered nickname in posts or replies', async () => {
  let writes = 0;
  const posts = buildPostService({ postRepository: { add() { writes++; } } });
  const comments = buildCommentService({ commentRepository: { add() { writes++; } } });
  for (const nickname of [undefined, '', 'x', 'has space', 'x@example.test', '1234567890123']) {
    const user = { uid: 'u1', role: 'admin', displayName: 'LooksValid', email: 'private@example.test', nickname };
    assert.equal(getBoardNickname(user), '');
    await assert.rejects(posts.createPost({ title: 't', content: 'c', author: user }), { code: 'NICKNAME_REQUIRED' });
    await assert.rejects(comments.createComment({ post: { id: 'p1', category: 'free' }, content: 'reply', user }), { code: 'NICKNAME_REQUIRED' });
  }
  assert.equal(writes, 0);
});

test('post submission ignores a forged nickname in form values and requires the current profile', async () => {
  let writes = 0;
  const submit = createSubmitPostUseCase({ postService: { createPost() { writes++; } },
    getCurrentUser: () => ({ uid: 'u1', displayName: 'LooksValid' }), getCurrentUserProfile: () => null });
  await assert.rejects(submit({ values: { title: 't', content: 'c', author: { nickname: 'Forged' } } }), { code: 'NICKNAME_REQUIRED' });
  assert.equal(writes, 0);
});

test('members without a nickname retain ownership rights on existing posts and comments', async () => {
  const calls = [];
  const user = { uid: 'u1' };
  const posts = buildPostService({ postRepository: { update: (...args) => calls.push(args), remove: (...args) => calls.push(args) } });
  const comments = buildCommentService({ commentRepository: { softDelete: (...args) => calls.push(args) } });
  await posts.updatePost({ id: 'p1', title: 'edited', content: 'body', user, post: { authorUid: 'u1', category: 'free' } });
  await posts.deletePost({ id: 'p1', user, post: { authorUid: 'u1', category: 'free' } });
  await comments.deleteComment({ post: { id: 'p1', category: 'free' }, comment: { id: 'c1', authorUid: 'u1' }, user });
  assert.equal(calls.length, 3);
});

test('write access transitions guest → nickname required → ready without duplicate prompts', () => {
  const previous = { window: globalThis.window, document: globalThis.document, localStorage: globalThis.localStorage };
  const children = [];
  const section = { querySelector: (id) => children.find((n) => `#${n.id}` === id), appendChild(node) { children.push(node); } };
  globalThis.window = {};
  globalThis.localStorage = { getItem: () => 'ko' };
  globalThis.document = { createElement() { return { style: {}, querySelector: () => null, remove() { children.splice(children.indexOf(this), 1); } }; } };
  try {
    const writeForm = { style: {} }, user = { uid: 'u1', displayName: 'LooksValid' };
    renderWriteAccess({ section, writeForm, user: null });
    assert.equal(writeForm.style.display, 'none'); assert.equal(children[0].id, 'board-write-login-required');
    for (let i = 0; i < 2; i++) renderWriteAccess({ section, writeForm, user, profile: {} });
    assert.equal(children.length, 1); assert.equal(children[0].id, 'board-write-nickname-required');
    assert.match(children[0].innerHTML, /href="\/account\/"/);
    renderWriteAccess({ section, writeForm, user, profile: { nickname: '회원닉네임' } });
    assert.equal(writeForm.style.display, ''); assert.equal(children.length, 0);
    renderWriteAccess({ section, writeForm, user: null });
    assert.equal(writeForm.style.display, 'none'); assert.equal(children[0].id, 'board-write-login-required');
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});

test('comments hide composer and replies until nickname setup while preserving owner deletion', () => {
  let Component;
  const selected = [];
  const source = readFileSync('src/domains/board/ui/board-comments.js', 'utf8').replace(/^import .*;\r?\n/gm, '');
  const context = { getBoardNickname, escapeHtml, COMMENT_MAX_LENGTH: 1000,
    HTMLElement: class { attachShadow() { this.shadowRoot = { innerHTML: '', querySelectorAll: () => [], querySelector: (selector) => { selected.push(selector); return null; } }; } },
    customElements: { get: () => null, define: (_name, Type) => { Component = Type; } },
  };
  vm.runInNewContext(source, context);
  const view = new Component();
  view.configure({ user: { uid: 'u1', displayName: 'LooksValid' } });
  view.setComments([{ id: 'c1', authorUid: 'u1', authorName: 'OldName', content: 'reply' }]);
  assert.equal(view.shadowRoot.innerHTML.includes('<textarea'), false);
  assert.match(view.shadowRoot.innerHTML, /닉네임 설정하기/);
  assert.equal(selected.includes('.login'), false, 'nickname setup link must not open the login modal');
  assert.ok(selected.includes('button.login'));
  assert.match(view.shadowRoot.innerHTML, /<button class="delete"/);
  assert.equal(view.shadowRoot.innerHTML.includes('<button class="reply-button"'), false);
  view.updateUser({ uid: 'u1', nickname: '회원닉네임' });
  assert.match(view.shadowRoot.innerHTML, /<textarea/);
  assert.match(view.shadowRoot.innerHTML, /<button class="reply-button"/);
  view.updateUser(null);
  assert.equal(view.shadowRoot.innerHTML.includes('<textarea'), false);
  assert.match(view.shadowRoot.innerHTML, /로그인이 필요합니다/);
});

test('migration refuses emulator hosts on production projects or nonlocal addresses', () => {
  assert.throws(() => createPrivacyClient({ projectId: 'production-portfolio-example', emulatorHost: 'localhost:8085' }));
  assert.throws(() => createPrivacyClient({ projectId: 'demo-test', emulatorHost: 'example.test:8085' }));
});
