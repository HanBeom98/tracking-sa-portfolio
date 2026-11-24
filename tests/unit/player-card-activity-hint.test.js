import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("player card makes the activity view discoverable without forcing motion", () => {
  const component = fs.readFileSync(
    "src/domains/stats/sudden-attack/ui/components/player-card.js",
    "utf8",
  );
  const styles = fs.readFileSync(
    "src/domains/stats/sudden-attack/ui/components/player-card-styles.js",
    "utf8",
  );

  assert.match(component, />프로필 · 활동<\/summary>/);
  assert.match(styles, /@keyframes activity-menu-shine/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /summary::before \{[\s\S]*display: none/);
});
