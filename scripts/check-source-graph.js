#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import manifest from './deployment-artifacts.js';
import { listFiles, javaScriptReferences, scriptTags } from './source-analysis.js';

// Existing composition root: these three constructor imports intentionally assemble infrastructure.
export const compositionExceptions = [
  ['src/domains/stats/sudden-attack/application/sa-app-composition.js', 'src/domains/stats/sudden-attack/infra/nexon-api-client.js'],
  ['src/domains/stats/sudden-attack/application/sa-app-composition.js', 'src/domains/stats/sudden-attack/infra/sa-repository.js'],
  ['src/domains/stats/sudden-attack/application/sa-app-composition.js', 'src/domains/stats/sudden-attack/infra/crew-repository.js'],
  // Existing board import compatibility facade intentionally reexports the shared auth gateway.
  ['src/domains/board/application/authGateway.js', 'src/domains/auth/infra/auth-gateway.js'],
];
const isJavaScript = value => /\.[cm]?js$/.test(value);
const layer = file => file.startsWith('src/domains/') ? file.split('/').find(part => ['domain', 'application', 'infra', 'ui'].includes(part)) : null;

export function checkSourceGraph(root = process.cwd(), { deployment = manifest, exceptions = compositionExceptions, injectedSources = ['src/shared/infra/templates.py'] } = {}) {
  const errors = [], warnings = [], published = new Map(), texts = new Map(), urls = new Map();
  try {
    for (const [source, destination] of Object.entries(deployment.copyRoots)) {
      for (const file of listFiles(root, source, deployment.copyPolicy)) {
        const suffix = file.slice(source.length + 1);
        if (Object.keys(deployment.retiredGuides).some(slug => suffix === `guides/${slug}/index.html`)) continue;
        published.set('/' + path.posix.join(destination.replace(/^public\/?/, ''), suffix), file);
      }
    }
    for (const asset of deployment.rootAssets) published.set('/' + asset, asset);
    for (const [file, destination] of Object.entries(deployment.fileCopies)) published.set('/' + destination.replace(/^public\//, ''), file);
    for (const [url, file] of published) {
      if (!/\.(?:[cm]?js|html)$/.test(file)) continue;
      texts.set(file, fs.readFileSync(path.join(root, file), 'utf8')); urls.set(file, url);
    }
  } catch (error) { return { errors: [error.message], warnings, checked: 0, reachable: 0, edges: 0 }; }
  const scripts = [...texts.keys()].filter(isJavaScript);
  if (!scripts.length) errors.push('No deployed browser JavaScript found');
  const graph = new Map(scripts.map(file => [file, new Set()]));
  const modules = new Map(scripts.map(file => [file, new Set()]));
  const roots = new Set(), usedExceptions = new Set();
  const connect = (from, reference, { entry = false, module = false } = {}) => {
    const spec = reference.specifier;
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(spec)) return;
    if (!spec.startsWith('.') && !spec.startsWith('/') && !entry) {
      if (module) errors.push(`${from}:${reference.line}: unmapped bare browser module ${spec}`);
      return;
    }
    const clean = spec.split(/[?#]/)[0];
    if (!isJavaScript(clean)) {
      if (module) errors.push(`${from}:${reference.line}: unsupported local module URL ${spec}`);
      return;
    }
    const url = path.posix.resolve(path.posix.dirname(urls.get(from) || '/index.html'), clean);
    const target = published.get(url);
    if (!target || !graph.has(target)) { errors.push(`${from}:${reference.line || 1}: missing local JS ${spec}`); return; }
    if (entry) roots.add(target); else graph.get(from)?.add(target);
    if (!module || !modules.has(from)) return;
    modules.get(from).add(target);
    const sourceLayer = layer(from), targetLayer = layer(target);
    const forbidden = sourceLayer === 'domain' && ['application', 'infra', 'ui'].includes(targetLayer)
      || sourceLayer === 'application' && ['infra', 'ui'].includes(targetLayer);
    if (forbidden) {
      const key = JSON.stringify([from, target]);
      if (exceptions.some(pair => JSON.stringify(pair) === key)) usedExceptions.add(key);
      else errors.push(`${from}:${reference.line}: forbidden ${sourceLayer} -> ${targetLayer} import ${target}`);
    }
  };
  const readJavaScript = (file, source, entry = false) => {
    try {
      const refs = javaScriptReferences(source);
      for (const ref of refs.modules) connect(file, ref, { entry, module: !entry });
      for (const ref of refs.literals) connect(file, ref, { entry });
      for (const line of refs.dynamic) warnings.push(`${file}:${line}: nonliteral dynamic import needs manual review`);
    } catch (error) { errors.push(`${file}: ${error.message}`); }
  };
  const readTags = (file, source) => {
    for (const tag of scriptTags(source)) {
      if (tag.src) connect(file, { specifier: tag.src, line: 1 }, { entry: true });
      else if (tag.body.trim()) readJavaScript(file, tag.body.replaceAll('{{FIREBASE_CONFIG}}', 'null'), true);
    }
  };
  for (const [file, source] of texts) {
    if (isJavaScript(file)) readJavaScript(file, source);
    else readTags(file, source);
  }
  for (const file of injectedSources) {
    try { readTags(file, fs.readFileSync(path.join(root, file), 'utf8')); }
    catch (error) { errors.push(`${file}: ${error.message}`); }
  }
  for (const pair of exceptions) if (!usedExceptions.has(JSON.stringify(pair))) errors.push(`Stale composition exception: ${pair.join(' -> ')}`);
  const reachable = new Set();
  const visit = file => { if (reachable.has(file)) return; reachable.add(file); for (const target of graph.get(file) || []) visit(target); };
  for (const file of roots) visit(file);
  for (const file of scripts) if (!reachable.has(file)) errors.push(`${file}: unconnected browser JS candidate (no source entry path)`);
  const visited = new Set(), active = new Set(), stack = [], cycles = new Set();
  const detectCycle = file => {
    if (active.has(file)) { cycles.add(stack.slice(stack.indexOf(file)).concat(file).join(' -> ')); return; }
    if (visited.has(file)) return;
    visited.add(file); active.add(file); stack.push(file);
    for (const target of modules.get(file) || []) detectCycle(target);
    stack.pop(); active.delete(file);
  };
  for (const file of scripts) detectCycle(file);
  for (const cycle of cycles) errors.push(`Literal module cycle: ${cycle}`);
  return { errors: [...new Set(errors)], warnings, checked: scripts.length, reachable: reachable.size,
    edges: [...graph.values()].reduce((sum, targets) => sum + targets.size, 0) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = checkSourceGraph();
  for (const warning of result.warnings) console.warn(`[source-graph] REVIEW: ${warning}`);
  if (result.errors.length) { console.error(`[source-graph] FAILED:\n${result.errors.join('\n')}`); process.exitCode = 1; }
  else console.log(`[source-graph] OK: ${result.checked} browser JS files, ${result.reachable} connected, ${result.edges} literal edges; no missing local JS, unconnected candidates, forbidden imports or literal module cycles.`);
}
