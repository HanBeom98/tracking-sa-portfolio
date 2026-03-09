import { test } from "node:test";
import assert from "node:assert/strict";
import { CrewRepository } from "../../src/domains/games/sudden-attack/infra/crew-repository.js";

test("CrewRepository calculates season seed from recent and older archives", () => {
  const repo = new CrewRepository(null);
  const recentArchive = {
    members: {
      alpha: {
        characterName: "Alpha",
        finalMmr: 1380,
        finalHsr: 1420,
        matchCount: 18,
        mmrHistory: [{ mmr: 1380, hsr: 1420, date: "2026-03-06T10:00:00.000Z" }]
      }
    }
  };
  const olderArchive = {
    members: {
      alpha: {
        characterName: "Alpha",
        finalMmr: 1300,
        finalHsr: 1320,
        matchCount: 12,
        mmrHistory: [{ mmr: 1300, hsr: 1320, date: "2026-02-27T10:00:00.000Z" }]
      }
    }
  };

  const result = repo.calculateSeasonSeed("alpha", recentArchive, olderArchive);

  assert.equal(result.seedMeta.source, "recent+older");
  assert.equal(result.seedMeta.recentWeight, 0.75);
  assert.equal(result.seedMeta.olderWeight, 0.25);
  assert.equal(result.seedMeta.baselineWeight, 0);
  assert.equal(result.seedHsr, 1356);
  assert.equal(result.seedMmr, 1328);
});

test("CrewRepository shrinks low-sample season seed toward baseline", () => {
  const repo = new CrewRepository(null);
  const recentArchive = {
    members: {
      bravo: {
        characterName: "Bravo",
        finalMmr: 1500,
        finalHsr: 1560,
        matchCount: 3,
        mmrHistory: [{ mmr: 1500, hsr: 1560, date: "2026-03-06T10:00:00.000Z" }]
      }
    }
  };
  const olderArchive = {
    members: {
      bravo: {
        characterName: "Bravo",
        finalMmr: 1260,
        finalHsr: 1280,
        matchCount: 8,
        mmrHistory: [{ mmr: 1260, hsr: 1280, date: "2026-02-27T10:00:00.000Z" }]
      }
    }
  };

  const result = repo.calculateSeasonSeed("bravo", recentArchive, olderArchive);

  assert.equal(result.seedMeta.recentWeight, 0.30);
  assert.equal(result.seedMeta.olderWeight, 0.30);
  assert.equal(result.seedMeta.baselineWeight, 0.40);
  assert.equal(result.seedHsr, 1306);
  assert.equal(result.seedMmr, 1286);
});

test("CrewRepository falls back to recent archive and baseline when older data is missing", () => {
  const repo = new CrewRepository(null);
  const recentArchive = {
    members: {
      charlie: {
        characterName: "Charlie",
        finalMmr: 1340,
        finalHsr: 1360,
        matchCount: 9,
        mmrHistory: [{ mmr: 1340, hsr: 1360, date: "2026-03-06T10:00:00.000Z" }]
      }
    }
  };

  const result = repo.calculateSeasonSeed("charlie", recentArchive, null);

  assert.equal(result.seedMeta.source, "recent");
  assert.equal(result.seedMeta.recentWeight, 0.55);
  assert.equal(result.seedMeta.olderWeight, 0);
  assert.equal(result.seedMeta.baselineWeight, 0.45);
  assert.equal(result.seedHsr, 1270);
  assert.equal(result.seedMmr, 1262);
});

test("CrewRepository keeps MMR flat and applies only HSR seed on season reset", () => {
  const repo = new CrewRepository(null);
  const resetState = repo.buildSeasonResetState({
    seedMmr: 1340,
    seedHsr: 1388,
    seedMeta: { source: "recent+older" }
  });

  assert.equal(resetState.mmr, 1200);
  assert.equal(resetState.hsr, 1388);
  assert.equal(resetState.seasonSeedMmr, 1200);
  assert.equal(resetState.seasonSeedHsr, 1388);
  assert.equal(resetState.seasonSeedSource, "recent+older");
  assert.deepEqual(resetState.mmrHistory, []);
});

test("CrewRepository boosts HSR seed with manual highest tier", () => {
  const repo = new CrewRepository(null);
  const recentArchive = {
    members: {
      delta: {
        characterName: "Delta",
        finalMmr: 1260,
        finalHsr: 1280,
        matchCount: 4,
        manualSeedTier: "GRANDMASTER",
        mmrHistory: [{ mmr: 1260, hsr: 1280, date: "2026-03-06T10:00:00.000Z" }]
      }
    }
  };
  const olderArchive = {
    members: {
      delta: {
        characterName: "Delta",
        finalMmr: 1220,
        finalHsr: 1230,
        matchCount: 9,
        manualSeedTier: "GRANDMASTER",
        mmrHistory: [{ mmr: 1220, hsr: 1230, date: "2026-02-27T10:00:00.000Z" }]
      }
    }
  };

  const result = repo.calculateSeasonSeed("delta", recentArchive, olderArchive);

  assert.equal(result.seedMeta.manualSeedTier, "GRANDMASTER");
  assert.ok(Math.abs(result.seedMeta.recentWeight - 0.165) < 1e-9);
  assert.ok(Math.abs(result.seedMeta.olderWeight - 0.165) < 1e-9);
  assert.ok(Math.abs(result.seedMeta.baselineWeight - 0.22) < 1e-9);
  assert.equal(result.seedMeta.manualWeight, 0.45);
  assert.equal(result.seedMeta.source, "recent+older+manual-tier");
  assert.equal(result.seedHsr, 1287);
  assert.equal(result.seedMmr, 1219);
});
