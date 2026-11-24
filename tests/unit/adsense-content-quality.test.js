import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFormInsight } from '../../src/domains/stats/sudden-attack/ui/runtime/public-search-presenters.js';
for (const [win, kd, expected] of [[75,60,'모두 상승'],[65,50,'모두 하락'],[75,50,'흐름이 다름'],[70,60,'승률 유지 · 킬뎃 상승'],[70,55,'비슷한 성적']]) {
  test('form direction for '+win+'/'+kd, () => {
    const html=renderFormInsight({seasonViews:{current:{stats:{totalMatchesCount:20,winRate:win,kdPercent:kd}},previous:{stats:{totalMatchesCount:20,winRate:70,kdPercent:55}}}});
    assert.ok(html.includes(expected)); assert.ok(!html.includes('신뢰도 높음'));
  });
}
test('short current sample does not claim a valid comparison', () => {
  const html=renderFormInsight({seasonViews:{current:{stats:{totalMatchesCount:3,winRate:100,kdPercent:90}},previous:{stats:{totalMatchesCount:20,winRate:70,kdPercent:55}}}});
  assert.ok(html.includes('비교 표본 부족')); assert.ok(!html.includes('<figure'));
});
test('crew views distinguish unplaced members, ties and empty highlights', async () => {
  const oldElement=globalThis.HTMLElement, oldRegistry=globalThis.customElements;
  globalThis.HTMLElement=class {getAttribute(){return '2026-07-11';} querySelectorAll(){return [];}};
  globalThis.customElements={define(){}};
  try {
    const {SaCrewRanking}=await import('../../src/domains/stats/sudden-attack/ui/components/crew-ranking.js');
    const {SaCrewHighlights}=await import('../../src/domains/stats/sudden-attack/ui/components/crew-highlights.js');
    const view=new SaCrewRanking();
    view.rankings=[{characterName:'zero',mmr:1200,wins:0,loses:0}];
    assert.ok(view.innerHTML.includes('미배치')); assert.ok(!view.innerHTML.includes('#1'));
    assert.ok(!view.innerHTML.includes('>1200<')); assert.ok(!view.innerHTML.includes('>0%'));
    view.rankings=[{characterName:'zero',mmr:1800,wins:0,loses:0},{characterName:'a',mmr:1300,wins:1,loses:0},{characterName:'b',mmr:1300,wins:2,loses:0},{characterName:'c',mmr:1200,wins:0,loses:1}];
    assert.equal((view.innerHTML.match(/>#1</g)||[]).length,2); assert.ok(view.innerHTML.includes('>#3<'));
    const highlights=new SaCrewHighlights();
    highlights.data={timeline:['season start']}; assert.equal(highlights.hidden,true); assert.equal(highlights.innerHTML,'');
    highlights.data={todayMvp:{name:'a',diff:20,mmr:1300}};
    assert.equal(highlights.hidden,false); assert.ok(highlights.innerHTML.includes('data-name="a"'));
    highlights.data={}; assert.equal(highlights.innerHTML,'');
  } finally {globalThis.HTMLElement=oldElement;globalThis.customElements=oldRegistry;}
});
