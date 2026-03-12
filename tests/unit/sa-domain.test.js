import { test } from "node:test";
import assert from "node:assert";
import { Player } from "../../src/domains/stats/sudden-attack/domain/player.js";
import { MatchRecord } from "../../src/domains/stats/sudden-attack/domain/match.js";
import { RecentStats } from "../../src/domains/stats/sudden-attack/domain/stats.js";

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

  // Radar logic check: combat should be < 85, precision > 90
  assert.ok(stats.radar.combat < 85);
  assert.ok(stats.radar.precision >= 90);
  assert.strictEqual(stats.playstyleIcon, "🤖"); // Human Aimbot
});

test("SA RecentStats can derive season metrics from filtered matches", () => {
  const info = {
    recent_kill_death_rate: 99.0,
    recent_win_rate: 99.0,
    recent_assault_rate: 99.0,
    user_name: "heel"
  };
  const matches = [
    { kill: 6, death: 13, assist: 5, headshot: 3, mapName: "시티캣", matchResult: "LOSE", isCustomMatch: true, kd: "0.46", allPlayerStats: [] },
    { kill: 10, death: 8, assist: 3, headshot: 4, mapName: "프로방스", matchResult: "WIN", isCustomMatch: true, kd: "1.25", allPlayerStats: [] }
  ];

  const stats = new RecentStats(info, matches, null, { forceMatchMetrics: true });
  assert.equal(stats.totalMatchesCount, 2);
  assert.equal(stats.kdPercent, 43); // 16 / (16 + 21)
  assert.equal(stats.winRate, 50.0);
  assert.ok(stats.radar.precision > 45 && stats.radar.precision < 46);
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
