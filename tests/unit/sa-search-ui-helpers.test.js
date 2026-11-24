import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getFavoriteSearches,
  getRecentSearches,
  isFavoriteSearch,
  normalizeSearchName,
  removeFavoriteSearch,
  saveSearch,
  toggleFavoriteSearch
} from '../../src/domains/stats/sudden-attack/ui/utils/ui-helpers.js';

const storage = new Map();

global.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  }
};

beforeEach(() => {
  storage.clear();
});

test('normalizeSearchName trims and collapses whitespace', () => {
  assert.equal(normalizeSearchName('  heel   runner  '), 'heel runner');
});

test('saveSearch keeps recent names unique case-insensitively', () => {
  saveSearch('recent', '  Heel  ');
  saveSearch('recent', 'heel');
  saveSearch('recent', 'TsChit');

  assert.deepEqual(getRecentSearches('recent'), ['TsChit', 'heel']);
});

test('toggleFavoriteSearch stores one favorite per nickname regardless of case', () => {
  assert.equal(toggleFavoriteSearch('favorites', '  Heel '), true);
  assert.equal(toggleFavoriteSearch('favorites', 'heel'), false);
  assert.deepEqual(getFavoriteSearches('favorites'), []);
});

test('favorite lookup and removal are case-insensitive', () => {
  toggleFavoriteSearch('favorites', 'TsChit');
  assert.equal(isFavoriteSearch('favorites', 'tschit'), true);

  removeFavoriteSearch('favorites', 'TSCHIT');
  assert.deepEqual(getFavoriteSearches('favorites'), []);
});

test('malformed localStorage data falls back to empty collections', () => {
  localStorage.setItem('recent', '{bad json');

  assert.deepEqual(getRecentSearches('recent'), []);
});
