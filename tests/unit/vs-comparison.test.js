import test from 'node:test';
import assert from 'node:assert/strict';
import {getVsMetricRows,getVsSummary} from '../../src/domains/stats/sudden-attack/ui/components/stats-summary-vm.js';
import {getVsComparisonData} from '../../src/domains/stats/sudden-attack/ui/runtime/public-search-presenters.js';
import {renderVsStatsCard} from '../../src/domains/stats/sudden-attack/ui/components/vs-stats-renderer.js';

const stats=(values={})=>({totalMatchesCount:20,kdPercent:50,winRate:50,avgK:4,...values});

test('one K/D advantage cannot outvote the opposite win-rate advantage by being counted twice',()=>{
  const rows=getVsMetricRows(stats({kdPercent:60,winRate:40}),stats({kdPercent:50,winRate:60}),'public');
  assert.deepEqual(rows.map(row=>row.label),['K/D','승률','경기당 킬']);
  assert.equal(rows.length,3);
  assert.deepEqual(rows.map(row=>row.winner),['primary','target','draw']);
  const summary=getVsSummary('A','B',rows);
  assert.equal(summary.score,'1:1');assert.equal(summary.tone,'neutral');
  assert.doesNotMatch(summary.detail,/MMR|HSR/);
});

test('metric units use K/D and win-rate percentage points plus kills per match',()=>{
  const rows=getVsMetricRows(stats({kdPercent:60,winRate:55.5,avgK:'4.6'}),stats({kdPercent:55,winRate:50,avgK:'4.4'}),'public');
  assert.deepEqual(rows.map(row=>row.delta),[5,5.5,0.2]);
  assert.deepEqual(rows.map(row=>row.deltaUnit),['%p','%p','킬']);
  assert.equal(rows[2].primaryText,'4.6');
});

test('missing samples or numeric metrics are not converted into losing zero values',()=>{
  const rows=getVsMetricRows(stats({totalMatchesCount:0}),stats(),'public');
  assert.ok(rows.every(row=>row.winner==='unavailable'&&row.primaryText==='—'));
  assert.equal(getVsSummary('A','B',rows).score,'비교 보류');
  for(const value of [undefined,null,'',NaN,Infinity,'invalid']) {
    const [row]=getVsMetricRows(stats({kdPercent:value}),stats(),'public');
    assert.equal(row.winner,'unavailable');assert.equal(row.delta,null);
  }
});

test('confirmed zero kills and wins remain valid, while a zero K/D denominator is unavailable',()=>{
  const a=stats({kdPercent:0,winRate:0,avgK:0,totalKills:0,totalDeaths:4});
  assert.ok(getVsMetricRows(a,stats(),'public').every(row=>row.winner==='target'));
  assert.equal(getVsMetricRows({...a,totalDeaths:0},stats(),'public')[0].winner,'unavailable');
});

test('league comparison preserves MMR and HSR without manufacturing scores for non-members',()=>{
  const rows=getVsMetricRows(stats({isCrew:true,crewMmr:1300,crewHsr:1200}),stats({isCrew:true,crewMmr:1250,crewHsr:1300}));
  assert.deepEqual(rows.map(row=>row.label),['K/D','승률','내전 MMR','내전 HSR']);
  assert.deepEqual(rows.slice(2).map(row=>row.winner),['primary','target']);
  assert.ok(getVsMetricRows(stats({isCrew:false,crewMmr:1200}),stats()).slice(2).every(row=>row.winner==='unavailable'));
});

test('selected public windows share their stats and sample counts; absent previous data cannot fall back to current',()=>{
  const profile=(nickname,previous)=>({player:{nickname},stats:stats({kdPercent:99}),seasonViews:{
    current:{stats:stats({kdPercent:80}),matches:[{matchId:'current'}]},
    ...(previous?{previous:{stats:stats({kdPercent:30,totalMatchesCount:6}),matches:[{matchId:'previous'}]}}:{})
  }});
  const a=profile('A',true),b=profile('B',false);
  const result=getVsComparisonData(a,b,'previous','public');
  assert.equal(result.primaryView.stats.kdPercent,30);
  assert.equal(result.primaryView.stats.totalMatchesCount,6);
  assert.equal(result.targetView.stats.totalMatchesCount,0);
  assert.equal(result.targetView.stats.kdPercent,undefined);
  assert.deepEqual(result.primaryView.matches,[{matchId:'previous'}]);
  assert.match(result.comparisonLabel,/21~40/);
  assert.equal(b.stats.kdPercent,99);
  assert.equal(getVsComparisonData(a,b,'current','public').targetView.stats.kdPercent,80);
  assert.equal(getVsComparisonData(a,b,'previous','league').comparisonLabel,'지난 시즌');
});

test('VS markup discloses actual sample counts, distinguishes official cards, escapes names and labels, and withholds an empty radar',()=>{
  const rows=getVsMetricRows(stats(),stats(),'public');
  const html=renderVsStatsCard({summary:getVsSummary('<b>A</b>','B',rows),rows,primaryName:'<b>A</b>',targetName:'B',context:'public',comparisonLabel:'이전 <i>구간</i>',primaryCount:20,targetCount:6});
  assert.match(html,/20경기 \/ B 6경기/);
  assert.match(html,/&lt;b&gt;A&lt;\/b&gt;/);
  assert.match(html,/이전 &lt;i&gt;구간&lt;\/i&gt;/);
  assert.match(html,/별도의 공식 제공 정보/);
  assert.match(html,/독립적인 투표가 아닙니다/);
  assert.match(html,/표본이 적어/);
  const empty=renderVsStatsCard({summary:getVsSummary('A','B',[]),rows:[],primaryName:'A',targetName:'B',context:'public',primaryCount:0,targetCount:20});
  assert.doesNotMatch(empty,/<sa-radar-chart/);
  assert.match(empty,/비교 보류/);
});
