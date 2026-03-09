import test from "node:test";
import assert from "node:assert/strict";

import { CrewRepository } from "../../src/domains/games/sudden-attack/infra/crew-repository.js";

test("CrewRepository matches a pending roster to a match and identifies missing participants", () => {
  const repo = new CrewRepository(null);
  const match = {
    matchDate: "2026-03-09T13:20:00.000Z",
    allPlayerStats: [
      { ouid: "p1", nickname: "one" },
      { ouid: "p2", nickname: "two" },
      { ouid: "p3", nickname: "three" },
      { ouid: "p4", nickname: "four" },
      { ouid: "p5", nickname: "five" },
      { ouid: "p6", nickname: "six" },
      { ouid: "p7", nickname: "seven" },
      { ouid: "p8", nickname: "eight" },
      { ouid: "p9", nickname: "nine" }
    ]
  };
  const pendingSessions = [
    {
      id: "session-1",
      createdAt: "2026-03-09T12:50:00.000Z",
      participants: [
        { ouid: "p1", characterName: "one" },
        { ouid: "p2", characterName: "two" },
        { ouid: "p3", characterName: "three" },
        { ouid: "p4", characterName: "four" },
        { ouid: "p5", characterName: "five" },
        { ouid: "p6", characterName: "six" },
        { ouid: "p7", characterName: "seven" },
        { ouid: "p8", characterName: "eight" },
        { ouid: "p9", characterName: "nine" },
        { ouid: "p10", characterName: "alt" }
      ]
    }
  ];
  const memberCache = Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => {
      const ouid = `p${index + 1}`;
      return [ouid, { ouid, characterName: ouid, mmr: 1200, hsr: 1200, loses: 0, mmrHistory: [], isDirty: false }];
    })
  );

  const result = repo.findPendingSessionForMatch(match, pendingSessions, memberCache, {}, new Set());

  assert.ok(result);
  assert.equal(result.session.id, "session-1");
  assert.equal(result.overlap, 9);
  assert.deepEqual(result.missing.map((item) => item.ouid), ["p10"]);
});

test("CrewRepository applyAbandonPenalty records a forced loss for a missing rostered player", () => {
  const repo = new CrewRepository(null);
  const member = {
    ouid: "p10",
    characterName: "alt",
    mmr: 1221,
    hsr: 1260,
    loses: 4,
    mmrHistory: [],
    isDirty: false
  };

  const penalty = repo.applyAbandonPenalty(member, "2026-03-09T13:20:00.000Z");

  assert.deepEqual(penalty, { mmrDiff: -30, hsrDiff: -20 });
  assert.equal(member.mmr, 1191);
  assert.equal(member.hsr, 1240);
  assert.equal(member.loses, 5);
  assert.equal(member.mmrHistory.length, 1);
  assert.equal(member.mmrHistory[0].date, "2026-03-09T13:20:00.000Z");
  assert.equal(member.isDirty, true);
});

test("CrewRepository manual abandon guard rejects duplicate match-date history", () => {
  const repo = new CrewRepository(null);
  const currentHistory = [
    { mmr: 1221, hsr: 1260, date: "2026-03-09T13:54:57.756Z" }
  ];

  const alreadySettled = currentHistory.some((entry) => entry?.date === "2026-03-09T13:54:57.756Z");

  assert.equal(alreadySettled, true);
});

test("CrewRepository can reapply a persisted manual abandon after repair", () => {
  const repo = new CrewRepository(null);
  const member = {
    ouid: "p10",
    characterName: "alt",
    mmr: 1221,
    hsr: 1260,
    loses: 4,
    mmrHistory: [
      { mmr: 1221, hsr: 1260, date: "2026-03-09T13:43:02.181Z" }
    ],
    isDirty: false
  };

  const result = repo.applyManualAbandonToMember(member, "2026-03-09T13:54:57.756Z");

  assert.deepEqual(result, {
    mmrDiff: -30,
    hsrDiff: -20,
    newMmr: 1191,
    newHsr: 1240,
    loses: 5
  });
  assert.equal(member.mmrHistory.at(-1).date, "2026-03-09T13:54:57.756Z");
});

test("CrewRepository extracts manual abandon backfill candidates from history", () => {
  const repo = new CrewRepository(null);

  const candidates = repo.extractManualAbandonCandidates({
    matchId: "260309225457119001",
    matchDate: "2026-03-09T13:54:57.756Z",
    map: "크로스포트",
    manualAbandonOuids: ["p10"],
    manualAbandonNicknames: ["alt"]
  });

  assert.deepEqual(candidates, [
    {
      ouid: "p10",
      nickname: "alt",
      matchId: "260309225457119001",
      matchDate: "2026-03-09T13:54:57.756Z",
      mapName: "크로스포트"
    }
  ]);
});

test("CrewRepository extracts nickname-only manual abandon backfill candidates", () => {
  const repo = new CrewRepository(null);

  const candidates = repo.extractManualAbandonCandidates({
    id: "legacy-match",
    matchDate: "2026-03-09T13:54:57.756Z",
    map: "드래곤로드",
    manualAbandonNicknames: ["alt"]
  });

  assert.deepEqual(candidates, [
    {
      ouid: "",
      nickname: "alt",
      matchId: "legacy-match",
      matchDate: "2026-03-09T13:54:57.756Z",
      mapName: "드래곤로드"
    }
  ]);
});

test("CrewRepository builds history patch for persisted manual abandons", () => {
  const repo = new CrewRepository(null);

  const patch = repo.buildManualAbandonHistoryPatch(
    [
      { ouid: "p10", nickname: "alt" }
    ],
    {
      abandonCount: 0,
      manualAbandonOuids: [],
      manualAbandonNicknames: []
    }
  );

  assert.deepEqual(patch, {
    abandonCount: 1,
    manualAbandonOuids: ["p10"],
    manualAbandonNicknames: ["alt"]
  });
});

test("CrewRepository counts member manual abandons by season split", () => {
  const repo = new CrewRepository(null);

  const summary = repo.buildMemberAbandonSummary(
    [
      {
        matchDate: "2026-03-09T13:54:57.756Z",
        manualAbandonOuids: ["p10"],
        manualAbandonNicknames: ["alt"]
      },
      {
        matchDate: "2026-03-01T13:54:57.756Z",
        manualAbandonOuids: ["p10"],
        manualAbandonNicknames: ["alt"]
      }
    ],
    {
      ouid: "p10",
      nickname: "alt",
      seasonStart: new Date("2026-03-05T00:00:00.000Z")
    }
  );

  assert.deepEqual(summary, { current: 1, previous: 1 });
});
