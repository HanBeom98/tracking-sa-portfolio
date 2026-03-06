import { test } from "node:test";
import assert from "node:assert";
import { CrewHighlightsService } from "../../src/domains/games/sudden-attack/application/crew-highlights-service.js";

test("crew highlights service builds weekly highlight view model", () => {
  const service = new CrewHighlightsService();
  const rankings = [
    {
      characterName: "A",
      mmr: 1300,
      wins: 8,
      loses: 4,
      mmrHistory: [
        { date: "2026-03-06T10:00:00.000Z", mmr: 1220 },
        { date: "2026-03-06T11:00:00.000Z", mmr: 1260 }
      ]
    },
    {
      characterName: "B",
      mmr: 1285,
      wins: 7,
      loses: 5,
      mmrHistory: [
        { date: "2026-03-06T10:00:00.000Z", mmr: 1240 },
        { date: "2026-03-06T11:00:00.000Z", mmr: 1250 }
      ]
    }
  ];
  const history = [
    { matchId: "m1", map: "프로방스", matchDate: "2026-03-06T12:00:00.000Z", crewCount: 10 },
    { matchId: "m2", map: "프로방스", matchDate: "2026-03-05T12:00:00.000Z", crewCount: 10 },
    { matchId: "m3", map: "시티캣", matchDate: "2026-03-04T12:00:00.000Z", crewCount: 10 }
  ];
  const seasonStart = new Date("2026-03-01T00:00:00.000Z");

  const vm = service.build(rankings, history, seasonStart);

  assert.equal(vm.todayMvp.name, "A");
  assert.equal(vm.weeklyRival.a.characterName, "A");
  assert.equal(vm.weeklyRival.b.characterName, "B");
  assert.equal(vm.weeklyMaps[0].map, "프로방스");
  assert.ok(vm.timeline.length > 0);
});
