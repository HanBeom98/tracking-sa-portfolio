import test from 'node:test';
import assert from 'node:assert/strict';
import { DISCORD_TEST_APPLICATION_ID as APP, createDiscordSignatureFixture, discordIngressRejections } from '../fixtures/discord-interaction.js';
import { createDiscordInteractionHandler } from '../../functions/api/discord-interaction.js';

const fixture = createDiscordSignatureFixture();
const { publicKey, signedRequest: signed } = fixture;
const input = (type, data) => ({ type, application_id: APP, member: { user: { id: '101' } }, data });
const forbidden = () => assert.fail('Legacy adapter must not load on this route');

test('v2 stale commands, components and modals return private migration guidance without loading rollback code', async () => {
  const handle = createDiscordInteractionHandler({ loadLegacy: forbidden });
  for (const value of [input(2, { name: '대내모집' }), input(2, { name: '전적검색' }),
    input(3, { custom_id: 'start_balance' }), input(5, { custom_id: 'register_nickname' }), input(99, {})]) {
    const response = await handle({ request: signed(JSON.stringify(value)), env: { DISCORD_PUBLIC_KEY: publicKey, DISCORD_BOT_VERSION: '2' },
      waitUntil() { assert.fail('No legacy storage task allowed'); } });
    const body = await response.json();
    assert.equal(body.type, 4); assert.equal(body.data.flags, 64);
    assert.deepEqual(body.data.allowed_mentions, { parse: [] });
    assert.match(body.data.embeds[0].description, /기존 내전 명령은 종료/);
  }
});

test('ping and new help keep their existing routes even when the rollback loader is unavailable', async () => {
  const handle = createDiscordInteractionHandler({ loadLegacy: forbidden });
  for (const version of [undefined, '1', '2']) {
    const env = { DISCORD_PUBLIC_KEY: publicKey, DISCORD_BOT_VERSION: version };
    const ping = await handle({ request: signed('{"type":1}'), env });
    assert.deepEqual(await ping.json(), { type: 1 });
    const help = await handle({ request: signed(JSON.stringify(input(2, { name: '도움말' }))), env });
    const body = await help.json(); assert.equal(body.type, 4); assert.equal(body.data.flags, 64);
  }
});

test('legacy rollback forwards the original verified context and exact signed body once per interaction', async () => {
  for (const version of [undefined, '1']) for (const value of [input(2, { name: '대내모집' }), input(3, { custom_id: 'refresh_list' }), input(5, { custom_id: 'register_nickname' })]) {
    const raw = ' \n' + JSON.stringify({ ...value, note: '한글 원본 본문' }) + '\n';
    const context = { request: signed(raw), env: { DISCORD_PUBLIC_KEY: publicKey, DISCORD_BOT_VERSION: version }, waitUntil() {} };
    let loads = 0, calls = 0;
    const expected = new Response('rollback response', { status: 202 });
    const handle = createDiscordInteractionHandler({ loadLegacy: async () => {
      loads++;
      return { handleLegacyDiscordInteraction(actual, parsed, body, app) {
        calls++; assert.equal(actual, context); assert.equal(body, raw); assert.equal(app, APP);
        assert.deepEqual(parsed, JSON.parse(raw)); return expected;
      } };
    } });
    assert.equal(await handle(context), expected); assert.equal(loads, 1); assert.equal(calls, 1);
  }
});

test('method, size, signature, freshness, JSON and application rejection all precede the rollback loader', async () => {
  const handle = createDiscordInteractionHandler({ loadLegacy: forbidden });
  for (const { name, request, status } of discordIngressRejections(fixture, { command: '대내모집' })) {
    assert.equal((await handle({ request, env: { DISCORD_PUBLIC_KEY: publicKey } })).status, status, name);
  }
});
