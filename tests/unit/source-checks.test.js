import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkSourceGraph } from '../../scripts/check-source-graph.js';
import { checkApplicationBrowserBoundary } from '../../scripts/check-application-browser-boundary.js';
import { makeError } from '../../src/domains/board/domain/errors.js';
import { makeError as legacyError } from '../../src/domains/board/application/errors.js';
import * as categories from '../../src/domains/stats/sudden-attack/domain/public-match-categories.js';
import * as legacyCategories from '../../src/domains/stats/sudden-attack/application/public-match-categories.js';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tracking-sa-source-check-'));
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('tracking-sa-source-check-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const write = (file, source) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, source); };
  fs.mkdirSync(path.join(root, 'src/shared/assets'), { recursive: true });
  write('index.html', '<script type="module" src="/example/main.js"></script>');
  write('src/domains/example/main.js', 'export const ready = true;');
  const options = { deployment: { copyRoots: { 'src/domains': 'public', 'src/shared/assets': 'public' },
    rootAssets: ['index.html'], fileCopies: {}, retiredGuides: {}, copyPolicy: { excludedNames: ['README.md'], excludedSuffixes: ['.full'], excludedDirectories: ['__pycache__'] } },
    exceptions: [], injectedSources: [] };
  return { root, write, options, graph: (extra = {}) => checkSourceGraph(root, { ...options, ...extra }),
    browser: (extra = {}) => checkApplicationBrowserBoundary(root, { exceptions: [], ...extra }) };
}

test('source graph follows side effects, reexports, literal dynamic imports and loader URLs without treating comments as code', t => {
  const f = fixture(t);
  f.write('src/domains/example/main.js', `import './domain/side.js?v=one#hash';
    export { value } from './domain/export.js'; import(\`./ui/lazy.js\`);
    const loader = '/extra.js'; // import './ghost.js';
    const text = "import './also-ghost.js'";`);
  for (const file of ['domain/side', 'domain/export', 'ui/lazy']) f.write(`src/domains/example/${file}.js`, 'export const value = 1;');
  f.write('src/shared/assets/extra.js', 'globalThis.loaded = true;');
  f.write('index.html', `<script type="module" src="/example/main.js"></script>
    <!-- <script src="/ghost.js"></script> -->
    <script data-src="/not-a-source.js"></script>
    <script type="application/ld+json">{"url":"/not-code.js"}</script>`);
  const result = f.graph();
  assert.deepEqual(result.errors, []); assert.equal(result.checked, 5); assert.equal(result.reachable, 5);
});

test('source graph includes inline modules, deployed file copies and Python-injected script entries', t => {
  const f = fixture(t);
  f.options.deployment.fileCopies['src/shared/infra/runtime-config.js'] = 'public/runtime-config.js';
  f.write('src/shared/infra/runtime-config.js', 'globalThis.runtimeConfig = {};');
  f.write('src/shared/infra/templates.py', `head = '<script src="/runtime-config.js?v={version}"></script>'`);
  f.write('index.html', `<script type="module">import '/example/main.js';</script>
    <script>window.FIREBASE_CONFIG = {{FIREBASE_CONFIG}};</script>`);
  assert.deepEqual(f.graph({ injectedSources: ['src/shared/infra/templates.py'] }).errors, []);
});

test('missing imports and missing HTML scripts fail with source filenames', t => {
  const f = fixture(t);
  f.write('src/domains/example/main.js', "export * from './missing.js';");
  f.write('index.html', '<script src="/example/main.js"></script><script src="/missing-entry.js"></script>');
  const errors = f.graph().errors.join('\n');
  assert.match(errors, /example\/main.js:1: missing local JS .\/missing.js/);
  assert.match(errors, /index.html:1: missing local JS \/missing-entry.js/);
});

test('test-only references do not hide disconnected production candidates and the checker never deletes them', t => {
  const f = fixture(t), orphan = 'src/domains/example/orphan.js';
  f.write(orphan, 'export const value = 1;');
  f.write('tests/unit/example.test.js', `import '../../${orphan}';`);
  assert.ok(f.graph().errors.some(error => error.includes(orphan + ': unconnected')));
  assert.equal(fs.existsSync(path.join(f.root, orphan)), true);
});

test('literal module cycles fail even when every file has a page entry path', t => {
  const f = fixture(t);
  f.write('src/domains/example/main.js', "import './cycle.js';");
  f.write('src/domains/example/cycle.js', "import './main.js';");
  const result = f.graph();
  assert.equal(result.reachable, 2); assert.ok(result.errors.some(error => error.startsWith('Literal module cycle:')));
});

test('domain/application imports are checked across reexports and literal dynamic imports', t => {
  const f = fixture(t);
  f.write('src/domains/example/main.js', "import './domain/rule.js'; import './application/use-case.js';");
  f.write('src/domains/example/domain/rule.js', "export * from '../infra/store.js';");
  f.write('src/domains/example/application/use-case.js', "export const load = () => import('../ui/view.js');");
  f.write('src/domains/example/infra/store.js', 'export const value = 1;');
  f.write('src/domains/example/ui/view.js', 'export const value = 1;');
  const errors = f.graph().errors.join('\n');
  assert.match(errors, /forbidden domain -> infra/); assert.match(errors, /forbidden application -> ui/);
});

test('composition exceptions apply to one exact edge, reject extra UI imports and cannot remain stale', t => {
  const f = fixture(t), owner = 'src/domains/example/application/compose.js', target = 'src/domains/example/infra/store.js';
  f.write('src/domains/example/main.js', "import './application/compose.js';");
  f.write(owner, "import '../infra/store.js';"); f.write(target, 'export const value = 1;');
  const exceptions = [[owner, target]];
  assert.deepEqual(f.graph({ exceptions }).errors, []);
  f.write('src/domains/example/ui/view.js', 'export const value = 1;');
  f.write(owner, "import '../infra/store.js'; import '../ui/view.js';");
  assert.ok(f.graph({ exceptions }).errors.some(error => error.includes('forbidden application -> ui')));
  f.write(owner, 'export const ready = true;');
  assert.ok(f.graph({ exceptions }).errors.some(error => error.startsWith('Stale composition exception:')));
});

test('computed dynamic imports remain explicit manual-review warnings', t => {
  const f = fixture(t);
  f.write('src/domains/example/main.js', 'export const load = name => import(name);');
  const result = f.graph();
  assert.deepEqual(result.errors, []); assert.match(result.warnings[0], /nonliteral dynamic import needs manual review/);
});

test('native browser modules cannot silently import unmapped development packages', t => {
  const f = fixture(t);
  f.write('src/domains/example/main.js', "import 'acorn';");
  assert.match(f.graph().errors.join('\n'), /unmapped bare browser module acorn/);
});

test('source graph fails closed on absent source roots and JavaScript syntax errors', t => {
  const f = fixture(t);
  f.write('src/domains/example/main.js', 'export const = ;');
  assert.ok(f.graph().errors.some(error => error.includes('Unexpected token')));
  f.options.deployment.copyRoots['src/missing'] = 'public/missing';
  assert.match(f.graph().errors[0], /Missing source directory/);
});

test('browser patterns ignore comments, literal text, regexes and injected windowRef parameters', t => {
  const f = fixture(t);
  f.write('src/domains/example/application/view.js', `// document.body; alert('not code');
    const text = "window.db document.body .innerHTML"; const pattern = /window\\.db/;
    export function run(windowRef) { return windowRef.localStorage; }`);
  assert.deepEqual(f.browser().errors, []);
});

for (const code of ['window.db', 'window?.db', 'window["db"]', 'globalThis["window"]["db"]',
  'globalThis.document.body', 'globalThis["alert"]("x")', 'alert("x")', 'confirm("x")', 'prompt("x")',
  'node["innerHTML"] = "text"', 'const text = `actual ${document.body}`']) {
  test(`browser pattern check blocks executable ${code}`, t => {
    const f = fixture(t); f.write('src/domains/example/application/view.js', code + ';');
    assert.match(f.browser().errors.join('\n'), /view.js:1: browser\/DOM member pattern/);
  });
}

test('browser exception permits one reviewed expression and fails for extra access, duplicates or stale entries', t => {
  const f = fixture(t), file = 'src/domains/example/application/view.js';
  const expression = 'globalThis["window"]', exceptions = [{ file, expression, reason: 'Test of an explicit legacy i18n bridge.' }];
  f.write(file, expression + ';'); assert.deepEqual(f.browser({ exceptions }).errors, []);
  for (const source of [expression + '; document.body;', expression + ';' + expression + ';', 'export const ready = true;']) {
    f.write(file, source); assert.ok(f.browser({ exceptions }).errors.length > 0);
  }
});

test('browser pattern check fails closed on absent/empty application trees and invalid syntax', t => {
  const f = fixture(t);
  assert.match(f.browser().errors[0], /No application/);
  f.write('src/domains/example/application/view.js', 'export const = ;');
  assert.match(f.browser().errors[0], /Unexpected token/);
  assert.match(checkApplicationBrowserBoundary(path.join(f.root, 'missing')).errors[0], /Missing source directory/);
});

test('old ddd command and explicit browser command retain identical success and failure exit codes', t => {
  const f = fixture(t), repo = fileURLToPath(new URL('../../', import.meta.url));
  const run = (name, cwd) => spawnSync(process.execPath, [path.join(repo, 'scripts', name)], { cwd, encoding: 'utf8' });
  for (const [cwd, status] of [[repo, 0], [f.root, 1]]) {
    const old = run('check-ddd-boundary.js', cwd), current = run('check-application-browser-boundary.js', cwd);
    assert.equal(old.status, status, old.stderr); assert.equal(current.status, status, current.stderr);
    assert.equal(old.stdout, current.stdout); assert.equal(old.stderr, current.stderr);
  }
});

test('moved pure helpers keep old imports, error codes and category configuration identical', () => {
  assert.equal(makeError, legacyError);
  const error = legacyError('NICKNAME_REQUIRED');
  assert.ok(error instanceof Error); assert.equal(error.message, 'NICKNAME_REQUIRED'); assert.equal(error.code, 'NICKNAME_REQUIRED');
  assert.deepEqual(Object.keys(categories), Object.keys(legacyCategories));
  for (const name of Object.keys(categories)) assert.equal(categories[name], legacyCategories[name]);
  assert.equal(categories.getPublicMatchCategory('unknown'), categories.PUBLIC_MATCH_CATEGORY_CONFIG.all);
  assert.equal(Object.isFrozen(categories.PUBLIC_MATCH_CATEGORY_CONFIG), true);
});
