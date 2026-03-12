import test from "node:test";
import assert from "node:assert/strict";

import { buildSyntheticAbandonMatches } from "../../src/domains/stats/sudden-attack/application/abandon-match-service.js";

test("buildSyntheticAbandonMatches creates a synthetic abandon row when Nexon match history is missing", () => {
  const synthetic = buildSyntheticAbandonMatches(
    [],
    [
      {
        matchId: "260309225457119001",
        map: "크로스포트",
        matchDate: "2026-03-09T13:54:57.756Z",
        manualAbandonOuids: ["p10"],
        manualAbandonNicknames: ["alt"]
      }
    ],
    { ouid: "p10", nickname: "alt" }
  );

  assert.equal(synthetic.length, 1);
  assert.equal(synthetic[0].matchId, "260309225457119001");
  assert.equal(synthetic[0].matchResult, "ABANDON");
  assert.equal(synthetic[0].mapName, "크로스포트");
  assert.equal(synthetic[0].killDisplay, "-");
  assert.equal(synthetic[0].kdDisplay, "-");
  assert.equal(synthetic[0].mmrChange, -30);
  assert.equal(synthetic[0].hsrChange, -20);
});

test("buildSyntheticAbandonMatches does not create a synthetic abandon row when the match already exists", () => {
  const synthetic = buildSyntheticAbandonMatches(
    [
      { matchId: "260309225457119001", matchDate: "2026-03-09T13:54:57.756Z" }
    ],
    [
      {
        matchId: "260309225457119001",
        map: "크로스포트",
        matchDate: "2026-03-09T13:54:57.756Z",
        manualAbandonOuids: ["p10"],
        manualAbandonNicknames: ["alt"]
      }
    ],
    { ouid: "p10", nickname: "alt" }
  );

  assert.equal(synthetic.length, 0);
});
