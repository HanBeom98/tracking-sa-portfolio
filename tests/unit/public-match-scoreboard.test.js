import test from 'node:test';
import assert from 'node:assert/strict';
import { getPublicScoreGroups, renderPublicScoreboard } from '../../src/domains/stats/sudden-attack/ui/components/public-match-scoreboard.js';
import { MatchRecord } from '../../src/domains/stats/sudden-attack/domain/match.js';
import { createDrawDetail } from '../fixtures/sa-draw-match.js';

function fixture() {
  return new MatchRecord(createDrawDetail(), '퀵매치 클랜전', 'Subject', {names: [], ouids: []}, {ouid: 'local-subject', kill: 16, death: 13, result: '3'});
}

test('public draw groups preserve all twelve players and use IDs, including zero, to identify sides', () => {
  const match = fixture(), groups = getPublicScoreGroups(match);
  assert.deepEqual(groups.map(g => [g.label, g.result, g.players.length]), [['조회 선수 팀', 'DRAW', 6], ['상대 팀', 'DRAW', 6]]);
  assert.equal(groups.flatMap(g => g.players).length, 12);
  match.allPlayerStats.forEach(p => { p.teamId = null; });
  assert.deepEqual(getPublicScoreGroups(match).map(g => [g.label, g.players.length]), [['전체 참가자', 12]]);
});

test('unknown and unassigned participants stay visible without being attributed to an opponent', () => {
  const match = fixture();
  match.allPlayerStats.push({nickname: 'Unassigned', teamId: null, result: 'UNKNOWN'});
  const groups = getPublicScoreGroups(match);
  assert.equal(groups.flatMap(g => g.players).length, 13);
  assert.equal(groups[2].label, '팀 미확인');
  match.matchResult = 'WIN';
  match.allPlayerStats.forEach((p, i) => { p.teamId = null; p.result = i === 12 ? 'UNKNOWN' : i < 6 ? 'WIN' : 'LOSE'; });
  assert.deepEqual(getPublicScoreGroups(match).map(g => [g.label, g.players.length]), [['조회 선수 팀', 6], ['상대 팀', 6], ['결과 미확인 참가자', 1]]);
});

test('public scoreboard escapes names, preserves values, delays only known local map images and never invents a round score', () => {
  const match = fixture(); match.mapName = '프로방스(심플)';
  match.allPlayerStats[0].nickname = '<img onerror="bad()">';
  const html = renderPublicScoreboard(match);
  assert.match(html, /&lt;img onerror=&quot;bad\(\)&quot;&gt;/);
  assert.doesNotMatch(html, /<img onerror|src="https:|MVP|16:13/);
  assert.match(html, /data-map-src="\/stats\/sudden-attack\/assets\/maps\/5v5\/provence-simple.jpg"/);
  assert.match(html, /16 \/ 13 \/ 6/);
  assert.match(html, /2,470/);
  assert.match(html, /1회/);
  assert.match(html, /23:37/);
  match.mapName = 'unmapped'; match.matchDate = 'invalid';
  assert.doesNotMatch(renderPublicScoreboard(match), /data-map-src=/);
  assert.match(renderPublicScoreboard(match), /시간 미확인/);
});

test('missing and zero damage remain distinct; all-zero or corrupt damage cannot produce an invalid bar', () => {
  const match = fixture();
  match.allPlayerStats.forEach(p => { p.damage = 0; });
  match.allPlayerStats[1].damage = null; match.allPlayerStats[2].damage = NaN;
  const html = renderPublicScoreboard(match);
  assert.match(html, /width:0.00%/);
  assert.match(html, /<strong>0<\/strong>/);
  assert.match(html, /<strong>—<\/strong>/);
  assert.doesNotMatch(html, /width:(?:NaN|Infinity)|width:-/);
  assert.match(renderPublicScoreboard({}), /매치 상세 정보가 없습니다/);
  const partial = renderPublicScoreboard({mapName:'프로방스',kill:3,death:2,assist:1,damage:250,headshot:0});
  assert.match(partial, /3 \/ 2 \/ 1/);
  assert.match(partial, /0회/);
  assert.match(partial, /매치 상세 정보가 없습니다/);
});
