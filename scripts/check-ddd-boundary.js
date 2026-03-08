#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const DOMAINS_DIR = path.join(ROOT_DIR, "src", "domains");

const FORBIDDEN_RULES = [
  { label: "window", regex: /\bwindow\./g },
  { label: "document", regex: /\bdocument\./g },
  { label: "alert", regex: /\balert\s*\(/g },
  { label: "confirm", regex: /\bconfirm\s*\(/g },
  { label: "prompt", regex: /\bprompt\s*\(/g },
  { label: "innerHTML", regex: /\.innerHTML\b/g },
];

// Temporary debt baseline (Day 1): allows existing violations but blocks new ones.
const ALLOWED_LEGACY_FILES = new Set([
  "src/domains/games/application/gameService.js",
  "src/domains/games/ai-evolution/application/ai-evolution-game.js",
  "src/domains/games/tetris/application/tetris-game.js",
  "src/domains/news/application/news-admin-actions.js",
]);

function walkDirectory(dirPath, result = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(fullPath, result);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!fullPath.endsWith(".js")) continue;
    if (!fullPath.includes(`${path.sep}application${path.sep}`)) continue;
    result.push(fullPath);
  }
  return result;
}

function scanFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const matches = [];
  for (const rule of FORBIDDEN_RULES) {
    if (rule.regex.test(source)) {
      matches.push(rule.label);
    }
    rule.regex.lastIndex = 0;
  }
  return matches;
}

function toRepoPath(absPath) {
  return path.relative(ROOT_DIR, absPath).replace(/\\/g, "/");
}

function main() {
  if (!fs.existsSync(DOMAINS_DIR)) {
    console.log("[ddd-boundary] src/domains not found. Skip.");
    process.exit(0);
  }

  const applicationFiles = walkDirectory(DOMAINS_DIR);
  const newViolations = [];
  const legacyDebt = [];

  for (const file of applicationFiles) {
    const repoPath = toRepoPath(file);
    const ruleHits = scanFile(file);
    if (ruleHits.length === 0) continue;

    if (ALLOWED_LEGACY_FILES.has(repoPath)) {
      legacyDebt.push({ file: repoPath, rules: ruleHits });
      continue;
    }
    newViolations.push({ file: repoPath, rules: ruleHits });
  }

  if (legacyDebt.length > 0) {
    console.log("[ddd-boundary] legacy debt baseline:");
    for (const item of legacyDebt) {
      console.log(`- ${item.file} (${item.rules.join(", ")})`);
    }
  }

  if (newViolations.length > 0) {
    console.error("\n[ddd-boundary] NEW violation detected in application layer:");
    for (const item of newViolations) {
      console.error(`- ${item.file} (${item.rules.join(", ")})`);
    }
    console.error("\nRules: application layer must not directly access browser globals or DOM APIs.");
    process.exit(1);
  }

  console.log("\n[ddd-boundary] OK: no new boundary violations.");
}

main();
