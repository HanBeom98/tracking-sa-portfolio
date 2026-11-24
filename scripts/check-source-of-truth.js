#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import manifest from "./deployment-artifacts.js";

export const deploymentManifest = manifest;

export function walkFiles(root, directory, errors) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) {
    errors.push(`Missing source directory: ${directory}`);
    return [];
  }
  const result = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const policy = deploymentManifest.copyPolicy;
    if (policy.excludedDirectories.includes(entry.name) || policy.excludedNames.includes(entry.name)
      || policy.excludedSuffixes.some(suffix => entry.name.endsWith(suffix))) continue;
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) result.push(...walkFiles(root, relative, errors));
    else if (entry.isFile()) result.push(relative);
  }
  return result;
}

export function normalizeGeneratedVersions(buffer) {
  return buffer.toString("utf8").replace(/\r\n/g, "\n")
    .replace(/(\.(?:js|css))\?v=[a-zA-Z0-9._-]+/g, "$1");
}

export function checkSourceOfTruth(root = process.cwd()) {
  const errors = [];
  const mirrors = new Map();
  for (const [sourceRoot, destination] of Object.entries(deploymentManifest.copyRoots)) {
    const sources = walkFiles(root, sourceRoot, errors).filter((file) => /\.(js|css)$/.test(file));
    if (sources.length === 0 && sourceRoot !== "src/static") errors.push(`No JS/CSS sources: ${sourceRoot}`);
    for (const source of sources) mirrors.set(source, `${destination}/${source.slice(sourceRoot.length + 1)}`);
  }
  for (const [source, destination] of Object.entries(deploymentManifest.fileCopies)) mirrors.set(source, destination);

  // Explicit mappings must also fail if their source disappears or their destination changes.
  const mapPath = path.join(root, "scripts/public_sync_map.txt");
  if (!fs.existsSync(mapPath)) errors.push("Missing source map: scripts/public_sync_map.txt");
  else for (const line of fs.readFileSync(mapPath, "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const [source, destination, extra] = line.trim().split("|");
    if (!source || !destination || extra !== undefined) errors.push(`Invalid source map entry: ${line}`);
    else if (mirrors.has(source) && mirrors.get(source) !== destination) errors.push(`Conflicting source map: ${source}`);
    else mirrors.set(source, destination);
  }

  for (const [source, destination] of mirrors) {
    const sourcePath = path.join(root, source);
    const mirrorPath = path.join(root, destination);
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) errors.push(`Missing source: ${source}`);
    else if (!fs.existsSync(mirrorPath) || !fs.statSync(mirrorPath).isFile()) errors.push(`Missing public mirror: ${source} -> ${destination}`);
    else if (normalizeGeneratedVersions(fs.readFileSync(sourcePath)) !== normalizeGeneratedVersions(fs.readFileSync(mirrorPath))) {
      errors.push(`Out-of-sync mirror: ${source} != ${destination}`);
    }
  }
  return { errors, checked: mirrors.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = checkSourceOfTruth();
  if (result.errors.length) {
    console.error(`[source-of-truth] FAILED:\n${result.errors.join("\n")}\nRun: npm run build`);
    process.exitCode = 1;
  } else console.log(`[source-of-truth] OK: ${result.checked} src files validated.`);
}
