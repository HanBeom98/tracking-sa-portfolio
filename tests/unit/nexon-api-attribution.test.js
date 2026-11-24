import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const TERMS_URL = "https://openapi.nexon.com/ko/support/terms/";

test("NEXON Open API attribution is visible globally and beside result data", () => {
  const footer = fs.readFileSync("src/shared/ui/footer.html", "utf8");
  const home = fs.readFileSync("index.html", "utf8");
  const stats = fs.readFileSync("src/domains/stats/sudden-attack/index.html", "utf8");

  assert.match(footer, /본 서비스는[\s\S]*NEXON Open API[\s\S]*이용하여 데이터를 제공합니다/);
  assert.ok(footer.includes(TERMS_URL));
  assert.match(home, /NEXON Open API를 이용한 공개 전적/);
  assert.match(home, /SOOP 공식 API를 통한 서든어택 라이브 방송 정보/);
  assert.match(stats, /NEXON Open API 이용/);
  assert.match(stats, /서든어택 전적 데이터는[\s\S]*NEXON Open API[\s\S]*이용합니다/);
  assert.ok(stats.includes(TERMS_URL));
});

test("result source banners avoid the globally fixed header element", () => {
  const playerCard = fs.readFileSync(
    "src/domains/stats/sudden-attack/ui/components/player-card.js",
    "utf8",
  );
  const statsSummary = fs.readFileSync(
    "src/domains/stats/sudden-attack/ui/components/profile-stats-renderer.js",
    "utf8",
  );

  assert.doesNotMatch(playerCard, /<header class="sa-data-source-banner/);
  assert.doesNotMatch(statsSummary, /<header class="sa-data-source-banner/);
  assert.match(playerCard, /<div class="sa-data-source-banner sa-data-source-nexon"/);
  assert.match(statsSummary, /<div class="sa-data-source-banner sa-data-source-tracking"/);
});
