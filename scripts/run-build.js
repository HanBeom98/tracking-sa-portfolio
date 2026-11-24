import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { syncReplayCoachingModules } from './sync-replay-coaching-modules.mjs';

export function pythonCandidates(root) {
  return [
    ...['.venv', 'venv'].flatMap(directory => [
      { command: path.join(root, directory, 'Scripts', 'python.exe'), prepend: [] },
      { command: path.join(root, directory, 'bin', 'python'), prepend: [] },
    ]),
    { command: 'python', prepend: [] },
    { command: 'python3', prepend: [] },
    { command: 'py', prepend: ['-3'] },
  ];
}

export function resolvePython(root, { run = spawnSync, exists = existsSync } = {}) {
  for (const candidate of pythonCandidates(root)) {
    if (path.isAbsolute(candidate.command) && !exists(candidate.command)) continue;
    const result = run(candidate.command, [
      ...candidate.prepend, '-c', 'import sys; print(str(sys.version_info.major) + "." + str(sys.version_info.minor))',
    ], { encoding: 'utf8', timeout: 5000, windowsHide: true });
    if (result.error || result.status !== 0) continue;
    const [major, minor] = String(result.stdout || '').trim().split('.').map(Number);
    if (major === 3 && minor >= 11) return candidate;
  }
  throw new Error('Python 3.11+ was not found. Install Python or create .venv/venv with a supported interpreter.');
}

function main() {
  const root = process.cwd();
  const args = process.argv.slice(2);
  if (args[0] !== '--python-tests') syncReplayCoachingModules(root);
  const python = resolvePython(root);
  const target = args[0] === '--python-tests'
    ? ['-m', 'unittest', 'discover', '-s', 'tests/python', '-p', 'test_*.py', '-v']
    : [path.join(root, 'main.py'), ...args];
  const result = spawnSync(python.command, [...python.prepend, '-X', 'utf8', ...target], {
    stdio: 'inherit', cwd: root, shell: false, windowsHide: true,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { process.exitCode = main(); }
  catch (error) { console.error('Python command failed:', error.message); process.exitCode = 1; }
}
