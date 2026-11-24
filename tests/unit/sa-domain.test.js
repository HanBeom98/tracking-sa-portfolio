import { test } from "node:test";
import assert from "node:assert";
import { Player } from "../../src/domains/stats/sudden-attack/domain/player.js";
import { MatchRecord } from "../../src/domains/stats/sudden-attack/domain/match.js";
import {
  RecentStats,
  calculateCompetitiveRadar,
  calculateMatchContributionRadar,
  classifyPlaystyle,
  getPlaystyleCatalog
} from "../../src/domains/stats/sudden-attack/domain/stats.js";

test("SA Player model correctly maps Nexon data", () => {
  const ouid = "test-ouid";
  const basic = { user_name: "TestUser", clan_name: "TestClan" };
  const rank = { grade: "Major", grade_ranking: 100, grade_exp: 1000000, season_grade: "Grand Master" };
  const tier = { 
    solo_rank_match_tier: "Diamond", solo_rank_match_score: 2000, 
    party_rank_match_tier: "Platinum", party_rank_match_score: 1800 
  };
  const crewData = { ouids: ["test-ouid"], names: [] };

  const player = new Player(ouid, basic, rank, tier, crewData);

  assert.strictEqual(player.nickname, "TestUser");
  assert.strictEqual(player.isCrew, true);
  assert.strictEqual(player.soloTier, "Diamond");
  assert.strictEqual(player.partyTier, "Platinum");
});

test("SA MatchRecord model calculates K/D percentage and MVPs", () => {
  const detail = {
    match_id: "match-1",
    match_map: "Dragon Road",
    date_match: "2026-03-04T12:00:00Z",
    match_detail: [
      { user_name: "Me", kill: 10, death: 5, assist: 2, result: "1", damage: 1500, headshot: 3 },
      { user_name: "Other", kill: 2, death: 8, assist: 1, result: "1", damage: 500, headshot: 0 }
    ]
  };
  const typeName = "Clan Match";
  const targetName = "Me";

  const match = new MatchRecord(detail, typeName, targetName);

  assert.strictEqual(match.mapName, "Dragon Road");
  assert.strictEqual(match.matchResult, "WIN");
  assert.strictEqual(match.kill, 10);
  assert.strictEqual(match.kdPercent, 67); // 10 / (10 + 5) = 0.666...
  assert.strictEqual(match.allPlayerStats[0].isMvp, true);
});

test("SA MatchRecord keeps subject mapping stable when another player has identical K/D/result", () => {
  const detail = {
    match_id: "match-ambiguous-subject",
    match_map: "City Cat",
    date_match: "2026-03-06T18:02:30.674Z",
    match_detail: [
      { user_name: "츠칫", kill: 6, death: 13, match_result: "2" },
      { user_name: "xion", kill: 9, death: 11, match_result: "1" },
      { user_name: "heel", kill: 6, death: 13, match_result: "2" }
    ]
  };

  const subjectInfo = { ouid: "heel-ouid", kill: 6, death: 13, result: "2" };
  const match = new MatchRecord(detail, "퀵매치 클랜전", "heel", { names: ["heel", "츠칫"], ouids: [] }, subjectInfo);

  const heelStat = match.allPlayerStats.find((p) => p.nickname === "heel");
  const tschitStat = match.allPlayerStats.find((p) => p.nickname === "츠칫");

  assert.ok(heelStat);
  assert.ok(tschitStat);
  assert.strictEqual(heelStat.ouid, "heel-ouid");
  assert.strictEqual(tschitStat.ouid, null);
});

test("SA MatchRecord identifies a disguised nickname by OUID and uses its personal stats", () => {
  const detail = {
    match_id: "match-disguised-subject",
    match_map: "City Cat",
    date_match: "2026-07-30T12:00:00Z",
    match_detail: [
      { ouid: "other-ouid", user_name: "Other", kill: 2, death: 9, assist: 1, match_result: "2" },
      { ouid: "subject-ouid", user_name: "DisguisedMe", kill: 11, death: 4, assist: 3, match_result: "1" }
    ]
  };

  const match = new MatchRecord(detail, "Ranked", "CurrentMe", { names: [], ouids: [] }, {
    ouid: "subject-ouid",
    kill: 11,
    death: 4,
    result: "1"
  });

  assert.equal(match.matchResult, "WIN");
  assert.equal(match.kill, 11);
  assert.equal(match.death, 4);
  assert.equal(match.assist, 3);
  assert.equal(match.allPlayerStats[1].isSubject, true);
  assert.equal(match.allPlayerStats[1].ouid, "subject-ouid");
});

test("SA synergy and rivalry exclude the subject even when using a disguised nickname", () => {
  const matches = Array.from({ length: 3 }, (_, index) => ({
    kill: 8,
    death: 4,
    assist: 2,
    damage: 1000,
    headshot: 2,
    mapName: `Map-${index}`,
    matchResult: "WIN",
    kd: "2.00",
    allPlayerStats: [
      { nickname: "DisguisedMe", result: "WIN", isSubject: true },
      { nickname: "RealPartner", result: "WIN", isSubject: false },
      { nickname: "RealEnemy", result: "LOSE", isSubject: false }
    ]
  }));

  const stats = new RecentStats({
    user_name: "CurrentMe",
    recent_kill_death_rate: 66,
    recent_win_rate: 100
  }, matches);

  assert.equal(stats.bestPartner.nickname, "RealPartner");
  assert.equal(stats.prey.nickname, "RealEnemy");
});

test("SA RecentStats model assigns playstyle based on radar", () => {
  const info = {
    recent_kill_death_rate: 50.0, // Lower K/D to avoid Tactical Nuke
    recent_win_rate: 70.0,
    recent_assault_rate: 95.0,
    user_name: "Aimbot"
  };
  const matches = [
    { kill: 20, death: 5, assist: 5, mapName: "Provence", matchResult: "WIN" }
  ];

  const stats = new RecentStats(info, matches);

  assert.ok(Object.values(stats.radar).every((value) => value >= 0 && value <= 100));
  assert.strictEqual(stats.playstyleTitle, "분석 준비 중");
});

test("SA playstyle catalog exposes 50 distinct natural titles", () => {
  const catalog = getPlaystyleCatalog();
  assert.strictEqual(catalog.length, 50);
  assert.strictEqual(new Set(catalog).size, 50);
});

test("SA playstyle classifier combines the two strongest radar traits", () => {
  const playstyle = classifyPlaystyle({
    combat: 72,
    survival: 55,
    teamwork: 48,
    precision: 68,
    victory: 52
  }, 20);

  assert.strictEqual(playstyle.title, "교전 설계자");
  assert.match(playstyle.description, /여포력.*정밀도/);
});

test("SA RecentStats can derive season metrics from filtered matches", () => {
  const info = {
    recent_kill_death_rate: 99.0,
    recent_win_rate: 99.0,
    recent_assault_rate: 99.0,
    user_name: "heel"
  };
  const matches = [
    { kill: 6, death: 13, assist: 5, headshot: 3, damage: 1200, mapName: "시티캣", matchResult: "LOSE", isCustomMatch: true, kd: "0.46", allPlayerStats: [] },
    { kill: 10, death: 8, assist: 3, headshot: 4, damage: 1800, mapName: "프로방스", matchResult: "WIN", isCustomMatch: true, kd: "1.25", allPlayerStats: [] }
  ];

  const stats = new RecentStats(info, matches, null, { forceMatchMetrics: true });
  assert.equal(stats.totalMatchesCount, 2);
  assert.equal(stats.kdPercent, 43); // 16 / (16 + 21)
  assert.equal(stats.winRate, 50.0);
  assert.equal(stats.avgDamage, 1500);
  assert.ok(Object.values(stats.radar).every((value) => value >= 0 && value <= 100));
});

test("SA RecentStats keeps match-based radar isolated from official recent K/D", () => {
  const matches = [
    { kill: 2, death: 8, assist: 1, headshot: 1, mapName: "Warehouse", matchResult: "LOSE", allPlayerStats: [] }
  ];

  const lowOfficialKd = new RecentStats({
    recent_kill_death_rate: 10,
    recent_win_rate: 10,
    user_name: "public-player"
  }, matches, null, { forceMatchMetrics: true });
  const highOfficialKd = new RecentStats({
    recent_kill_death_rate: 90,
    recent_win_rate: 90,
    user_name: "public-player"
  }, matches, null, { forceMatchMetrics: true });

  assert.equal(lowOfficialKd.kdPercent, 20);
  assert.equal(highOfficialKd.kdPercent, 20);
  assert.deepEqual(highOfficialKd.radar, lowOfficialKd.radar);
  assert.equal(highOfficialKd.playstyleTitle, lowOfficialKd.playstyleTitle);
});

test("SA RecentStats resets displayed metrics to zero when season has no matches", () => {
  const info = {
    recent_kill_death_rate: 75.0,
    recent_win_rate: 80.0,
    recent_assault_rate: 60.0,
    user_name: "heel"
  };

  const stats = new RecentStats(info, [], null, { forceMatchMetrics: true });
  assert.equal(stats.kdPercent, 0);
  assert.equal(stats.winRate, 0);
  assert.equal(stats.totalMatchesCount, 0);
});

test("SA contribution radar is independent of match round format labels", () => {
  const baseMatch = {
    kill: 8,
    death: 4,
    assist: 3,
    damage: 1200,
    headshot: 3,
    matchResult: "WIN",
    allPlayerStats: [
      { kill: 8, death: 4, assist: 3, damage: 1200, headshot: 3, result: "WIN" },
      { kill: 4, death: 5, assist: 2, damage: 700, headshot: 1, result: "WIN" },
      { kill: 3, death: 6, assist: 1, damage: 600, headshot: 1, result: "WIN" },
      { kill: 2, death: 5, assist: 2, damage: 500, headshot: 0, result: "WIN" }
    ]
  };

  const ranked = calculateMatchContributionRadar({ ...baseMatch, matchTypeName: "랭크전 솔로" });
  const tournament = calculateMatchContributionRadar({ ...baseMatch, matchTypeName: "토너먼트" });
  const clan = calculateMatchContributionRadar({ ...baseMatch, matchTypeName: "클랜전" });
  assert.deepEqual(ranked, tournament);
  assert.deepEqual(tournament, clan);
});

test("SA contribution radar rewards stronger team-relative contribution", () => {
  const team = [
    { kill: 10, death: 3, assist: 4, damage: 1600, headshot: 4, result: "WIN" },
    { kill: 3, death: 6, assist: 2, damage: 550, headshot: 1, result: "WIN" },
    { kill: 2, death: 7, assist: 1, damage: 450, headshot: 0, result: "WIN" },
    { kill: 1, death: 6, assist: 1, damage: 350, headshot: 0, result: "WIN" }
  ];
  const carry = calculateMatchContributionRadar({
    ...team[0],
    matchResult: "WIN",
    allPlayerStats: team
  });
  const support = calculateMatchContributionRadar({
    ...team[1],
    matchResult: "WIN",
    allPlayerStats: team
  });

  assert.ok(carry.combat > support.combat);
  assert.ok(carry.survival > support.survival);
  assert.ok(carry.precision > support.precision);
});

test("SA competitive radar shrinks small samples toward neutral", () => {
  const match = {
    kill: 10,
    death: 2,
    assist: 4,
    damage: 1500,
    headshot: 4,
    matchResult: "WIN",
    allPlayerStats: [
      { kill: 10, death: 2, assist: 4, damage: 1500, headshot: 4, result: "WIN" },
      { kill: 2, death: 6, assist: 1, damage: 400, headshot: 0, result: "WIN" }
    ]
  };
  const sevenMatches = calculateCompetitiveRadar(Array.from({ length: 7 }, () => match));
  const fourteenMatches = calculateCompetitiveRadar(Array.from({ length: 14 }, () => match));

  assert.ok(Math.abs(sevenMatches.combat - 50) < Math.abs(fourteenMatches.combat - 50));
  assert.ok(Math.abs(sevenMatches.victory - 50) < Math.abs(fourteenMatches.victory - 50));
});
