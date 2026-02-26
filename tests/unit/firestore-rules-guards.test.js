import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readRules() {
  return readFileSync("firestore.rules", "utf8");
}

function normalize(content) {
  return content.replace(/\s+/g, " ").trim();
}

function extractMatchBlock(rules, matchPrefix) {
  const headerRegex = new RegExp(`match\\s+${escapeRegExp(matchPrefix)}\\s*\\{`);
  const headerMatch = headerRegex.exec(rules);
  if (!headerMatch) return "";

  const headerStart = headerMatch.index;
  const braceStart = headerStart + headerMatch[0].lastIndexOf("{");
  let depth = 1;
  let end = -1;
  for (let i = braceStart + 1; i < rules.length; i += 1) {
    const ch = rules[i];
    if (ch === "{") {
      depth += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) return "";
  return rules.slice(headerStart, end + 1);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("firestore rules: posts allow only public read + admin delete", () => {
  const rules = readRules();
  const block = normalize(extractMatchBlock(rules, "/posts/{document=**}"));

  assert.ok(block.includes("allow read: if true;"));
  assert.ok(block.includes("allow delete: if request.auth != null"));
  assert.ok(
    block.includes('get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";'),
  );
  assert.ok(block.includes("allow create, update: if false;"));
});

test("firestore rules: board_posts enforce author ownership", () => {
  const rules = readRules();
  const block = normalize(extractMatchBlock(rules, "/board_posts/{document=**}"));

  assert.ok(block.includes("allow read: if true;"));
  assert.ok(block.includes("allow create: if request.auth != null && request.resource.data.authorUid == request.auth.uid;"));
  assert.ok(block.includes("allow update, delete: if request.auth != null && resource.data.authorUid == request.auth.uid;"));
});

test("firestore rules: users role is immutable and defaults to free", () => {
  const rules = readRules();
  const block = normalize(extractMatchBlock(rules, "/users/{userId}"));

  assert.ok(block.includes("allow create: if request.auth != null"));
  assert.ok(block.includes('request.resource.data.role == "free";'));
  assert.ok(block.includes("allow update: if request.auth != null"));
  assert.ok(block.includes("request.resource.data.role == resource.data.role;"));
});

test("firestore rules: nicknames allow guarded create/delete only", () => {
  const rules = readRules();
  const block = normalize(extractMatchBlock(rules, "/nicknames/{nickname}"));

  assert.ok(block.includes("allow read: if true;"));
  assert.ok(block.includes("allow create: if request.auth != null"));
  assert.ok(block.includes("request.resource.data.uid == request.auth.uid"));
  assert.ok(block.includes("!exists(/databases/$(database)/documents/nicknames/$(nickname));"));
  assert.ok(block.includes("allow delete: if request.auth != null && resource.data.uid == request.auth.uid;"));
  assert.ok(block.includes("allow update: if false;"));
});

test("firestore rules: default deny exists", () => {
  const rules = readRules();
  const block = normalize(extractMatchBlock(rules, "/{document=**}"));

  assert.ok(block.includes("allow read, write: if false;"));
});
