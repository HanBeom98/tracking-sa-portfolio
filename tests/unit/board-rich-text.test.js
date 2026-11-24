import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_RICH_TEXT_MARKER, createSafeBoardLink } from '../../src/domains/board/domain/rich-text.js';

test('board rich text uses a versioned marker for backward compatibility', () => {
  assert.equal(BOARD_RICH_TEXT_MARKER, '[[board-rich:v1]]');
});

test('board rich text accepts only web links', () => {
  assert.equal(createSafeBoardLink('example.com/path'), 'https://example.com/path');
  assert.equal(createSafeBoardLink('javascript:alert(1)'), '');
  assert.equal(createSafeBoardLink('data:text/html,test'), '');
});
