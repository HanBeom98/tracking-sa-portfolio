import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderFormInsight,
  runMatchCategoryTransition
} from '../../src/domains/stats/sudden-attack/ui/runtime/public-search-view.js';

test('form insight explains the comparison and displays kill/death as percentage points', () => {
  const html = renderFormInsight({
    seasonViews: {
      current: {
        matches: Array(20),
        stats: { totalMatchesCount: 20, winRate: 60, kdPercent: 56 }
      },
      previous: {
        matches: Array(20),
        stats: { totalMatchesCount: 20, winRate: 40, kdPercent: 50 }
      }
    }
  });

  assert.match(html, /직전 20경기보다 성적 상승/);
  assert.match(html, /최신 1~20번째 경기와 21~40번째 경기/);
  assert.match(html, /승률 차이<\/span><strong>\+20\.0%p/);
  assert.match(html, /킬뎃 차이<\/span><strong>\+6\.0%p/);
});

for (const kdPercent of [51, 50.96, 51.04]) {
  test(`form insight distinguishes a lower win rate from unchanged displayed K/D (${kdPercent})`, () => {
    const html = renderFormInsight({
      seasonViews: {
        current: { stats: { totalMatchesCount: 20, winRate: 45, kdPercent } },
        previous: { stats: { totalMatchesCount: 20, winRate: 75, kdPercent: 51 } }
      }
    });

    assert.match(html, /승률 하락 · 킬뎃 유지/);
    assert.match(html, /승률은 낮아졌지만 킬뎃은 유지되었습니다/);
    assert.match(html, /킬뎃 차이<\/span><strong>0\.0%p/);
    assert.doesNotMatch(html, /승률과 킬뎃이 함께 낮아졌습니다/);
  });
}

test('form insight still describes a decline when both win rate and K/D fall', () => {
  const html = renderFormInsight({
    seasonViews: {
      current: { stats: { totalMatchesCount: 20, winRate: 45, kdPercent: 45 } },
      previous: { stats: { totalMatchesCount: 20, winRate: 75, kdPercent: 51 } }
    }
  });

  assert.match(html, /직전 20경기보다 성적 하락/);
  assert.match(html, /승률과 킬뎃이 함께 낮아졌습니다/);
  assert.match(html, /킬뎃 차이<\/span><strong>-6\.0%p/);
});

test('form insight keeps opposite win rate and K/D changes distinct', () => {
  const html = renderFormInsight({
    seasonViews: {
      current: { stats: { totalMatchesCount: 20, winRate: 45, kdPercent: 52 } },
      previous: { stats: { totalMatchesCount: 20, winRate: 75, kdPercent: 51 } }
    }
  });

  assert.match(html, /승률과 킬뎃 흐름이 다름/);
  assert.doesNotMatch(html, /킬뎃 유지|함께 낮아졌습니다/);
});

test('form chart preserves absolute rates, zero and 100 on the same percentage scale', () => {
  const html = renderFormInsight({ seasonViews: {
    current: { stats: { totalMatchesCount: 20, winRate: 0, kdPercent: 100 } },
    previous: { stats: { totalMatchesCount: 7, winRate: 100, kdPercent: 0 } }
  } });
  assert.match(html, /이전 7경기 → 최근 20경기/);
  assert.match(html, /공통 눈금 0~100%/);
  assert.match(html, /width:0%/);
  assert.match(html, /width:100%/);
  assert.match(html, />0\.0%<\/strong>/);
  assert.match(html, />100\.0%<\/strong>/);
  assert.match(html, /승률 차이<\/span><strong>-100\.0%p/);
  assert.match(html, /킬뎃 차이<\/span><strong>\+100\.0%p/);
});

for (const previous of [undefined, { stats: { totalMatchesCount: 6, winRate: 50, kdPercent: 50 } }]) {
  test(`form chart does not invent a baseline with ${previous ? 'six' : 'no previous'} matches`, () => {
    const html = renderFormInsight({ seasonViews: {
      current: { stats: { totalMatchesCount: 20, winRate: 50, kdPercent: 50 } }, previous
    } });
    assert.doesNotMatch(html, /<figure/);
    assert.match(html, /비교 표본 부족/);
    assert.doesNotMatch(html, /직전 20경기와 비슷한 성적/);
  });
}

test('match category transition clears pending state before rerender', async () => {
  const events = [];
  const profile = { player: { nickname: 'Tracking' } };

  const result = await runMatchCategoryTransition({
    load: async () => {
      events.push('load');
      return profile;
    },
    setPending: (pending) => events.push(`pending:${pending}`),
    render: (value) => events.push(`render:${value.player.nickname}`)
  });

  assert.equal(result, profile);
  assert.deepEqual(events, [
    'pending:true',
    'load',
    'pending:false',
    'render:Tracking'
  ]);
});

test('match category transition clears pending state after a failed request', async () => {
  const states = [];

  await assert.rejects(() => runMatchCategoryTransition({
    load: async () => { throw new Error('network'); },
    setPending: (pending) => states.push(pending),
    render: () => states.push('rendered')
  }), /network/);

  assert.deepEqual(states, [true, false]);
});

for (const fails of [false, true]) {
  test(`superseded category ${fails ? 'failure' : 'result'} cannot clear pending state or render`, async () => {
    const events = [];
    let current = true, resolve, reject;
    const transition = runMatchCategoryTransition({
      load: () => new Promise((res, rej) => { resolve = res; reject = rej; }),
      isCurrent: () => current,
      setPending: (pending) => events.push(pending),
      render: () => events.push('rendered')
    });
    current = false;
    if (fails) reject(new Error('old category failed'));
    else resolve({ player: { nickname: 'A' } });
    assert.equal(await transition, null);
    assert.deepEqual(events, [true]);
  });
}
