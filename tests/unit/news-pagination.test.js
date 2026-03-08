import test from "node:test";
import assert from "node:assert/strict";

import { setupPagination } from "../../src/domains/news/application/news-pagination.js";

function createCard() {
  return { style: { display: "" } };
}

test("news pagination hides control when cards are less than page size", () => {
  const cards = Array.from({ length: 5 }, createCard);
  const grid = {
    querySelectorAll: () => cards,
  };
  const pagination = { hidden: false };

  setupPagination({ grid, pagination });
  assert.equal(pagination.hidden, true);
});

test("news pagination renders first page and updates controls", () => {
  const cards = Array.from({ length: 13 }, createCard);
  const grid = {
    querySelectorAll: () => cards,
  };
  const pagination = { hidden: true };
  const indicator = { textContent: "" };

  const events = {};
  const prevBtn = {
    disabled: false,
    addEventListener: (name, fn) => {
      events.prev = fn;
    },
  };
  const nextBtn = {
    disabled: false,
    addEventListener: (name, fn) => {
      events.next = fn;
    },
  };

  setupPagination({ grid, pagination, prevBtn, nextBtn, indicator });

  assert.equal(pagination.hidden, false);
  assert.equal(indicator.textContent, "1 / 2");
  assert.equal(prevBtn.disabled, true);
  assert.equal(nextBtn.disabled, false);
  assert.equal(cards[0].style.display, "flex");
  assert.equal(cards[11].style.display, "flex");
  assert.equal(cards[12].style.display, "none");

  events.next();
  assert.equal(indicator.textContent, "2 / 2");
  assert.equal(prevBtn.disabled, false);
  assert.equal(nextBtn.disabled, true);
  assert.equal(cards[0].style.display, "none");
  assert.equal(cards[12].style.display, "flex");
});
