import test from "node:test";
import assert from "node:assert/strict";

import { filterSearchItems, normalizeSearchText, isSearchQueryValid } from "../../src/domains/search/application/search-data.js";

test("search data filter matches title and keywords case-insensitively", () => {
  const items = [
    { title: "NVIDIA Earnings", keywords: ["AI", "chips"] },
    { title: "Cloudflare Pages", keywords: ["deploy", "hook"] },
  ];

  assert.equal(filterSearchItems(items, "nvidia").length, 1);
  assert.equal(filterSearchItems(items, "HOOK").length, 1);
  assert.equal(filterSearchItems(items, "missing").length, 0);
});

test("Korean aliases find English titles while preserving the original item and order", () => {
  const items = [
    { title: 'Sudden Attack Stats', keywords: ['stats', '서든어택 전적'] },
    { title: 'Sudden Attack League Hub', keywords: ['league', '서든어택 리그'] }
  ];
  const before = structuredClone(items);
  assert.deepEqual(filterSearchItems(items, '서든어택'), items);
  assert.equal(filterSearchItems(items, '서든 어택 리그')[0], items[1]);
  assert.equal(filterSearchItems(items, 'suddenattack 리그')[0], items[1]);
  assert.equal(filterSearchItems(items, 'LEAGUE')[0], items[1]);
  assert.deepEqual(items, before);
});

test("description-only queries and multiple terms across fields are searchable", () => {
  const items = [{ title: 'Replay', description: '병영수첩 라운드 분석', keywords: ['JSON'] }];
  assert.equal(filterSearchItems(items, '병영수첩').length, 1);
  assert.equal(filterSearchItems(items, 'JSON 라운드').length, 1);
  assert.equal(filterSearchItems(items, 'JSON 개인정보').length, 0);
});

test("decomposed Hangul, compatibility Latin and extra whitespace normalize without changing titles", () => {
  const items = [{ title: 'Sudden Attack Stats', keywords: ['서든어택', '전적 검색'] }];
  assert.equal(filterSearchItems(items, '서든어택'.normalize('NFD')).length, 1);
  assert.equal(filterSearchItems(items, 'ＳＵＤＤＥＮ　ＡＴＴＡＣＫ').length, 1);
  assert.equal(filterSearchItems(items, ' 전적\t 검색\n').length, 1);
  assert.equal(normalizeSearchText('  ＳＴＡＴＳ\t전적  '), 'stats 전적');
  assert.equal(items[0].title, 'Sudden Attack Stats');
});

test("empty searches do not return every item and missing optional fields stay harmless", () => {
  const items = [{ title: 'Stats' }, { description: '리그', keywords: null }];
  assert.deepEqual(filterSearchItems(items, ' \t '), []);
  assert.equal(filterSearchItems(items, '리그').length, 1);
  assert.deepEqual(filterSearchItems(null, '리그'), []);
});

test("minimum query length counts normalized content rather than whitespace or Hangul decomposition", () => {
  for (const value of ['', ' ', ' a ', '가'.normalize('NFD'), 'a\t ']) assert.equal(isSearchQueryValid(value), false);
  for (const value of ['리그', 'AI', 'ＡＩ', '서든'.normalize('NFD')]) assert.equal(isSearchQueryValid(value), true);
});
