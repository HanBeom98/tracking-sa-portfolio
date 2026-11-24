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

test("firestore rules: board_posts enforce author ownership and immutability", () => {
  const rules = readRules();
  const block = normalize(extractMatchBlock(rules, "/board_posts/{postId}"));

  assert.ok(block.includes("allow read: if true;"));
  assert.ok(block.includes("allow create: if request.auth != null"));
  assert.ok(block.includes("isValidBoardPost(request.resource.data)"));
  assert.ok(block.includes("request.resource.data.category != \"notice\" || isStaff()"));
  assert.ok(block.includes("affectedKeys().hasOnly(['title', 'content', 'attachments'])"));
  assert.ok(block.includes("hasValidBoardAttachments(request.resource.data, resource.data.authorUid)"));
  assert.ok(block.includes("resource.data.authorUid == request.auth.uid && request.resource.data.authorUid == resource.data.authorUid && resource.data.category != \"notice\"")); // immutability and category check
  assert.ok(block.includes("|| isStaff()"));
});

test("firestore rules: users profile allow free role and admin email promotion", () => {
  const rules = readRules();
  const block = normalize(extractMatchBlock(rules, "/users/{userId}"));

  assert.ok(block.includes("allow create: if isOwner(userId)"));
  assert.ok(block.includes("isValidNewUserProfile(request.resource.data, userId)"));
  assert.ok(block.includes("request.resource.data.role == \"free\""));
  assert.ok(block.includes("(isAdminEmail() && request.resource.data.role == \"admin\")"));
  assert.ok(block.includes("allow update: if isOwner(userId)"));
  assert.ok(block.includes("affectedKeys().hasOnly(['email', 'displayName', 'photoURL', 'nickname', 'nicknameUpdatedAt', 'role'])"));
  assert.ok(block.includes("request.resource.data.role == resource.data.role"));
});

test("firestore rules: nickname ownership is coupled to the committed profile", () => {
  const rules = readRules();
  const block = normalize(extractMatchBlock(rules, "/nicknames/{nickname}"));

  assert.ok(block.includes("allow read: if true;"));
  assert.ok(block.includes("allow create: if request.auth != null"));
  assert.ok(block.includes("data.uid == request.auth.uid"));
  assert.ok(block.includes("keys().hasOnly(['uid', 'nickname', 'updatedAt'])"));
  assert.ok(block.includes("nickname == data.nickname.lower()"));
  assert.ok(block.includes("getAfter(/databases/$(database)/documents/users/$(request.auth.uid)).data.nickname == data.nickname"));
  assert.ok(block.includes("allow update: if request.auth != null && resource.data.uid == request.auth.uid && validClaim()"));
  assert.ok(block.includes("allow delete: if request.auth != null && resource.data.uid == request.auth.uid"));
  assert.ok(rules.includes("ownsNicknameAfter(data.nickname, userId)"));
  assert.ok(rules.includes("releasedPreviousNickname(data.nickname, userId)"));
});

test("firestore rules: default deny exists", () => {
  const rules = readRules();
  const block = normalize(extractMatchBlock(rules, "/{document=**}"));

  assert.ok(block.includes("allow read, write: if false;"));
});

test("firestore rules: comment writes require an atomic ten-second rate limit", () => {
  const rules = readRules();
  const comments = normalize(extractMatchBlock(rules, "/comments/{commentId}"));
  const limits = normalize(extractMatchBlock(rules, "/comment_rate_limits/{userId}"));

  assert.ok(comments.includes("hasFreshCommentRateLimit(commentId)"));
  assert.ok(rules.includes("getAfter(/databases/$(database)/documents/comment_rate_limits/$(request.auth.uid))"));
  assert.ok(rules.includes("data.commentId == commentId"));
  assert.ok(limits.includes("request.time >= resource.data.lastCommentAt + duration.value(10, 's')"));
  assert.ok(limits.includes("allow delete: if false;"));
});

test("firestore rules: comments are limited to free posts and immutable", () => {
  const rules = readRules();
  const block = normalize(extractMatchBlock(rules, "/comments/{commentId}"));

  assert.ok(block.includes('data.category == "free"'));
  assert.ok(block.includes("isValidBoardComment(request.resource.data)"));
  assert.ok(block.includes("data.parentId == null"));
  assert.ok(rules.includes("data.createdAt == request.time"));
  assert.ok(block.includes("commentId.matches('^[A-Za-z0-9]{20}$')"));
  assert.ok(rules.includes("data.parentId.matches('^[A-Za-z0-9]{20}$')"));
  assert.ok(block.includes("affectedKeys().hasOnly(['content', 'authorName', 'deleted'])"));
  assert.ok(block.includes("resource.data.authorUid == request.auth.uid"));
  assert.ok(block.includes("|| isStaff()"));
});

test("storage rules: board images enforce ownership, type and size", () => {
  const rules = normalize(readFileSync("storage.rules", "utf8"));

  assert.ok(rules.includes("match /board-images/{userId}/{imageId}"));
  assert.ok(rules.includes("request.auth.uid == userId"));
  assert.ok(rules.includes("request.resource.size <= 5 * 1024 * 1024"));
  assert.ok(rules.includes("request.resource.contentType == 'image/webp'"));
  assert.ok(rules.includes("allow update: if false;"));
  assert.ok(rules.includes("allow read, write: if false;"));
});

test("firestore rules: applications are bounded and session client writes are denied", () => {
  const rules = readRules();
  const applications = normalize(extractMatchBlock(rules, "/sa_crew_applications/{docId}"));
  const sessions = normalize(extractMatchBlock(rules, "/match_sessions/{guildId}"));
  const searches = normalize(extractMatchBlock(rules, "/popular_searches/{nickname}"));

  assert.ok(applications.includes("allow create: if request.auth != null"));
  assert.ok(applications.includes("docId == request.auth.uid"));
  assert.ok(applications.includes("keys().hasOnly(['applicantUid', 'characterName', 'ouid', 'status', 'appliedAt'])"));
  assert.ok(applications.includes("request.resource.data.applicantUid == request.auth.uid"));
  assert.ok(applications.includes("request.resource.data.status == 'PENDING'"));
  assert.ok(applications.includes("request.auth.uid == docId"));
  assert.ok(!sessions.includes("allow read, write: if true;"));
  assert.ok(sessions.includes("allow create, update: if false;"));
  assert.ok(!sessions.includes("request.auth"));
  assert.ok(sessions.includes("allow delete: if false;"));
  assert.ok(searches.includes("request.resource.data.count == resource.data.count + 1"));
});
