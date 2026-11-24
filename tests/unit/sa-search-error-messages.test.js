import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PLAYER_NOT_FOUND_MESSAGE,
  resolvePlayerNotFoundMessage,
  resolvePublicSearchError
} from '../../src/domains/stats/sudden-attack/application/search-error-messages.js';

test('SA player-not-found guidance covers one-character external display names', () => {
  const message = resolvePlayerNotFoundMessage(new Error('PLAYER_NOT_FOUND'));

  assert.equal(message, PLAYER_NOT_FOUND_MESSAGE);
  assert.match(message, /한 글자 닉네임/);
  assert.match(message, /실제 닉네임/);
  assert.match(message, /Open API/);
});

test('SA player-not-found guidance ignores unrelated errors', () => {
  assert.equal(resolvePlayerNotFoundMessage(new Error('NETWORK_FAILURE')), null);
});

test('public search errors provide actionable missing-player guidance', () => {
  const state = resolvePublicSearchError(new Error('PLAYER_NOT_FOUND'));
  assert.equal(state.title, '캐릭터를 찾을 수 없습니다.');
  assert.match(state.message, /실제 닉네임으로 다시 검색/);
});

test('public search errors distinguish limited access from a temporary failure', () => {
  assert.match(resolvePublicSearchError(new Error('TEST_KEY_LIMITATION')).message, /조회 가능한 캐릭터가 제한/);
  for (const error of [new Error('NETWORK_FAILURE'), null]) {
    const state = resolvePublicSearchError(error);
    assert.match(state.title, /불러오지 못했습니다/);
    assert.match(state.message, /검색 버튼을 눌러 다시 시도/);
    assert.doesNotMatch(state.message, /캐릭터를 찾을 수 없습니다/);
  }
});

test('public search distinguishes timeout and rate limit from a missing player', () => {
  assert.match(resolvePublicSearchError({ code: 'REQUEST_TIMEOUT' }).message, /대기 시간이 초과/);
  assert.match(resolvePublicSearchError({ code: 'RATE_LIMITED' }).message, /요청이 많아/);
  assert.doesNotMatch(resolvePublicSearchError({ code: 'REQUEST_TIMEOUT' }).title, /캐릭터를 찾을 수 없습니다/);
});
