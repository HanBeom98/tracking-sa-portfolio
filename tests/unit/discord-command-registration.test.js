import test from 'node:test';
import assert from 'node:assert/strict';
import { commandRegistrationPlan, registerCommands } from '../../scripts/discord-command-registration.js';

test('registration defaults to a network-free preview', async () => {
  const result = await registerCommands(commandRegistrationPlan([]), { fetchImpl() { assert.fail('No network in preview'); } });
  assert.equal(result.applied, false); assert.equal(result.scope, 'preview'); assert.equal(result.commands.length, 3);
  for (const args of [['--apply'], ['--apply', '--global'], ['--guild', 'invalid'], ['--global', '--guild', '123']]) assert.throws(() => commandRegistrationPlan(args));
});

test('registration requires a token and a successful create-only backup before writing commands', async () => {
  const plan = commandRegistrationPlan(['--guild', '123', '--apply', '--backup', 'snapshot.json']);
  assert.ok(plan.commands.every(command => !('contexts' in command) && !('integration_types' in command)));
  await assert.rejects(registerCommands(plan), /DISCORD_TOKEN/);
  const actions = [];
  const result = await registerCommands(plan, { token: 'synthetic-token',
    backupImpl(file, originals) { actions.push('backup'); assert.equal(file, 'snapshot.json'); assert.equal(originals[0].name, 'old'); },
    fetchImpl: async (url, options) => {
      assert.match(url, /\/guilds\/123\/commands$/); actions.push(options.method || 'GET');
      return Response.json(options.method === 'PUT' ? plan.commands : [{ name: 'old' }]);
    } });
  assert.deepEqual(actions, ['GET', 'backup', 'PUT']); assert.equal(result.applied, true);
  let writes = 0;
  await assert.rejects(registerCommands(plan, { token: 'synthetic', fetchImpl: async (url, options) => { if (options.method === 'PUT') writes++; return Response.json([]); },
    backupImpl() { throw new Error('Backup exists'); } }), /Backup exists/);
  assert.equal(writes, 0);
});

test('registration never overwrites after failed snapshot retrieval or hides uncertain PUT results', async () => {
  const plan = commandRegistrationPlan(['--global', '--apply', '--backup', 'snapshot.json']);
  await assert.rejects(registerCommands(plan, { token: 'test', fetchImpl: async () => new Response('', { status: 403 }), backupImpl() { assert.fail('No backup for failed read'); } }), /조회 실패/);
  await assert.rejects(registerCommands(plan, { token: 'test', backupImpl() {}, fetchImpl: async (url, options) => options.method === 'PUT' ? new Response('', { status: 429 }) : Response.json([]) }), /재실행 전에/);
});
