import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolvePython } from '../../scripts/run-build.js';

test('Python selection falls back when python is missing or older than 3.11', () => {
  const attempts = [];
  const selected = resolvePython(path.resolve('fixture'), {
    exists: () => false,
    run(command) { attempts.push(command); return command === 'python' ? { error: new Error('ENOENT'), status: null } : { status: 0, stdout: '3.11\n' }; },
  });
  assert.equal(selected.command, 'python3');
  assert.deepEqual(attempts, ['python', 'python3']);
  const launcher = resolvePython(path.resolve('fixture'), {
    exists: () => false,
    run(command) { return { status: 0, stdout: command === 'py' ? '3.12\n' : '3.10\n' }; },
  });
  assert.deepEqual(launcher, { command: 'py', prepend: ['-3'] });
});

test('Python selection prefers a supported project virtual environment', () => {
  const root = path.resolve('fixture');
  const interpreter = path.join(root, '.venv', 'Scripts', 'python.exe');
  const selected = resolvePython(root, { exists: command => command === interpreter, run: () => ({ status: 0, stdout: '3.12\n' }) });
  assert.equal(selected.command, interpreter);
});

test('Python selection reports an actionable failure when all candidates are unusable', () => {
  assert.throws(() => resolvePython(path.resolve('fixture'), { exists: () => false, run: () => ({ status: 0, stdout: 'not a version' }) }), /Python 3\.11\+ was not found/);
});
