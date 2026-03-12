#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const SRC_DOMAINS_DIR = path.join(ROOT_DIR, "src", "domains");
const SRC_SHARED_ASSETS_DIR = path.join(ROOT_DIR, "src", "shared", "assets");

const TRACKED_EXTENSIONS = new Set([".js", ".css"]);
function walkFiles(dirPath, result = []) {
  if (!fs.existsSync(dirPath)) return result;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, result);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!TRACKED_EXTENSIONS.has(path.extname(entry.name))) continue;
    result.push(fullPath);
  }
  return result;
}

function toRepoPath(absPath) {
  return path.relative(ROOT_DIR, absPath).replace(/\\/g, "/");
}

function readFileBuffer(absPath) {
  return fs.readFileSync(absPath);
}

function buffersEqual(a, b) {
  return a.length === b.length && a.equals(b);
}

function resolveMirrorCandidates(srcRepoPath) {
  if (srcRepoPath.startsWith("src/domains/stats/sudden-attack/")) {
    const rel = srcRepoPath.slice("src/domains/stats/sudden-attack/".length);
    return [
      `public/games/sudden-attack/${rel}`,
      `public/en/games/sudden-attack/${rel}`,
    ];
  }
  if (srcRepoPath.startsWith("src/domains/")) {
    const rel = srcRepoPath.slice("src/domains/".length);
    return [`public/${rel}`, `public/en/${rel}`];
  }
  if (srcRepoPath.startsWith("src/shared/assets/")) {
    const rel = srcRepoPath.slice("src/shared/assets/".length);
    return [`public/${rel}`, `public/en/${rel}`];
  }
  return [];
}

function main() {
  const srcFiles = [
    ...walkFiles(SRC_DOMAINS_DIR),
    ...walkFiles(SRC_SHARED_ASSETS_DIR),
  ];

  if (srcFiles.length === 0) {
    console.log("[source-of-truth] no tracked src files found. Skip.");
    process.exit(0);
  }

  const mismatches = [];

  for (const srcAbsPath of srcFiles) {
    const srcRepoPath = toRepoPath(srcAbsPath);
    const srcBuffer = readFileBuffer(srcAbsPath);
    const mirrorPaths = resolveMirrorCandidates(srcRepoPath);

    for (const mirrorRepoPath of mirrorPaths) {
      const mirrorAbsPath = path.join(ROOT_DIR, mirrorRepoPath);
      if (!fs.existsSync(mirrorAbsPath)) continue;
      const mirrorBuffer = readFileBuffer(mirrorAbsPath);
      if (!buffersEqual(srcBuffer, mirrorBuffer)) {
        mismatches.push({ srcRepoPath, mirrorRepoPath });
      }
    }
  }

  if (mismatches.length > 0) {
    console.error("[source-of-truth] out-of-sync mirrored files detected:");
    for (const item of mismatches) {
      console.error(`- ${item.srcRepoPath} != ${item.mirrorRepoPath}`);
    }
    console.error("\nRun: npm run sync:public (and rebuild if needed).");
    process.exit(1);
  }

  console.log(`[source-of-truth] OK: ${srcFiles.length} src files validated.`);
}

main();
