#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const REPO_ROOT = process.cwd();
const MAP_FILE = path.join(REPO_ROOT, "scripts", "public_sync_map.txt");

function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function parseMap() {
  const text = fs.readFileSync(MAP_FILE, "utf8");
  const publicToSrc = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const [src, pub] = line.split("|");
    if (!src || !pub) continue;
    publicToSrc.set(pub, src);
  }
  return publicToSrc;
}

function sameFile(a, b) {
  if (!fs.existsSync(a) || !fs.existsSync(b)) return false;
  return fs.readFileSync(a, "utf8") === fs.readFileSync(b, "utf8");
}

function main() {
  const changed = runGit(["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"])
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

  if (!changed.length) {
    console.log("[public-edit-policy] SKIP: no files changed in HEAD.");
    return;
  }

  const commitSubject = runGit(["log", "-1", "--pretty=%s"]);
  const isSyncCommit = commitSubject.startsWith("chore(sync):");
  const publicToSrc = parseMap();

  const changedSet = new Set(changed);
  const violations = [];

  for (const file of changed) {
    if (!publicToSrc.has(file)) continue;
    const src = publicToSrc.get(file);

    const srcPath = path.join(REPO_ROOT, src);
    const pubPath = path.join(REPO_ROOT, file);

    if (!fs.existsSync(srcPath)) {
      violations.push(`mapped source missing: ${src} (for ${file})`);
      continue;
    }

    if (!sameFile(srcPath, pubPath)) {
      violations.push(`public mirror drift: ${file} != ${src}`);
    }

    if (!isSyncCommit && !changedSet.has(src)) {
      violations.push(`public file changed without source in same commit: ${file} (expected ${src})`);
    }
  }

  if (isSyncCommit) {
    for (const file of changed) {
      if (file.startsWith("src/")) {
        violations.push(`sync commit must not include src changes: ${file}`);
      }
    }
  }

  if (violations.length) {
    console.error("[public-edit-policy] FAIL");
    for (const v of violations) console.error(`- ${v}`);
    console.error("Rule: source change commit first, then `chore(sync):` public mirror commit.");
    process.exit(1);
  }

  console.log("[public-edit-policy] OK");
}

main();
