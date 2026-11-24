import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';

export function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(child => walk(child, visit)); return; }
  if (node.type) visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key !== 'loc' && value && typeof value === 'object') walk(value, visit);
  }
}

export function parseJavaScript(source) {
  return parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
}

export function literalString(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
}

export function memberName(node) {
  return node?.computed ? literalString(node.property) : node?.property?.name;
}

export function listFiles(root, directory, policy = {}) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) throw new Error(`Missing source directory: ${directory}`);
  return fs.readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    if (policy.excludedNames?.includes(entry.name) || policy.excludedSuffixes?.some(suffix => entry.name.endsWith(suffix))) return [];
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return policy.excludedDirectories?.includes(entry.name) ? [] : listFiles(root, file, policy);
    return entry.isFile() ? [file] : [];
  });
}

export function javaScriptReferences(source) {
  const modules = [], literals = [], dynamic = [];
  walk(parseJavaScript(source), node => {
    if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source) {
      modules.push({ specifier: node.source.value, line: node.loc.start.line });
    }
    if (node.type === 'ImportExpression') {
      const specifier = literalString(node.source);
      if (specifier === null) dynamic.push(node.loc.start.line);
      else modules.push({ specifier, line: node.loc.start.line });
    }
    const value = literalString(node);
    if (value && /^(?:\.\.?\/|\/)(?!\/).*\.[cm]?js(?:[?#].*)?$/.test(value)) {
      literals.push({ specifier: value, line: node.loc.start.line });
    }
  });
  return { modules, literals, dynamic };
}

// Include HTML fragments and Python-injected <script> snippets as source entries.
export function scriptTags(source) {
  const tags = [], clean = source.replace(/<!--[\s\S]*?-->/g, '');
  const attribute = (text, name) => new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(text)?.slice(1).find(value => value !== undefined);
  for (const match of clean.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const type = (attribute(match[1], 'type') || '').toLowerCase();
    if (type && !['module', 'text/javascript', 'application/javascript'].includes(type)) continue;
    tags.push({ src: attribute(match[1], 'src'), body: match[2] });
  }
  return tags;
}
