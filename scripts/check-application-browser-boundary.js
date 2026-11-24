#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { listFiles, parseJavaScript, walk, memberName } from './source-analysis.js';

// Existing i18n bridge fallback. Match one exact expression, not a whole file allowlist.
export const browserPatternExceptions = [{
  file: 'src/domains/account/application/account-view-model.js',
  expression: 'globalThis["window"]',
  reason: 'Existing account translation fallback; localization behavior is retained.',
}];

export function checkApplicationBrowserBoundary(root = process.cwd(), { exceptions = browserPatternExceptions } = {}) {
  const errors = [];
  let files;
  try { files = listFiles(root, 'src/domains').filter(file => file.includes('/application/') && file.endsWith('.js')); }
  catch (error) { return { errors: [error.message], checked: 0 }; }
  if (!files.length) errors.push('No application JavaScript files found');
  const dialogs = new Set(['alert', 'confirm', 'prompt']);
  const used = new Set();
  const browserObject = node => node?.type === 'Identifier' && ['window', 'document'].includes(node.name)
    || node?.type === 'MemberExpression' && node.object?.name === 'globalThis' && ['window', 'document'].includes(memberName(node));
  for (const file of files) {
    try {
      const hits = new Set();
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      const hit = node => {
        const index = exceptions.findIndex(item => item.file === file && item.expression === source.slice(node.start, node.end) && item.reason);
        if (index >= 0 && !used.has(index)) used.add(index);
        else hits.add(node.loc.start.line);
      };
      walk(parseJavaScript(source), node => {
        if (node.type === 'MemberExpression' && (browserObject(node.object)
          || memberName(node) === 'innerHTML' || browserObject(node)
          || (node.object?.name === 'globalThis' && dialogs.has(memberName(node))))) hit(node);
        if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && dialogs.has(node.callee.name)) hit(node);
      });
      for (const line of hits) errors.push(`${file}:${line}: browser/DOM member pattern in application`);
    } catch (error) { errors.push(`${file}: ${error.message}`); }
  }
  exceptions.forEach((item, index) => { if (!used.has(index)) errors.push(`Stale browser pattern exception: ${item.file}: ${item.expression}`); });
  return { errors, checked: files.length, exceptions: used.size };
}

export function runApplicationBrowserBoundary() {
  const result = checkApplicationBrowserBoundary();
  if (result.errors.length) {
    console.error(`[application-browser-boundary] FAILED:\n${result.errors.join('\n')}`);
    process.exitCode = 1;
  } else console.log(`[application-browser-boundary] OK: ${result.checked} application files; window/document, dialogs and innerHTML patterns checked; ${result.exceptions} explicit legacy expression.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) runApplicationBrowserBoundary();
