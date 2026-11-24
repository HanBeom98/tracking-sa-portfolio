// Signed Discord ingress. Production v2 never loads the rollback-only adapter.
import discordApplication from '../../cloud-functions/discord-session-config.cjs';
import { handleDiscordBot, isNewDiscordInteraction } from '../discord/bot.js';
import { helpMessage } from '../discord/messages.js';

// Keep the former ingress limit on the active Cloudflare endpoint too.
async function readInteractionBody(request) {
  const maxBytes = 65536;
  if (!request.body?.getReader) {
    const text = await request.text();
    return new TextEncoder().encode(text).byteLength > maxBytes ? null : text;
  }
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > maxBytes) {
        try { await reader.cancel(); } catch { /* Still reject the oversized body. */ }
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

function hexToUint8Array(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}

async function verifyInteractionSignature(publicKey, signature, timestamp, body) {
  try {
    const key = await crypto.subtle.importKey('raw', hexToUint8Array(publicKey), 'Ed25519', false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, hexToUint8Array(signature), new TextEncoder().encode(timestamp + body));
  } catch {
    return false;
  }
}

export function createDiscordInteractionHandler({
  loadLegacy = () => import('../discord/legacy-handler.js'),
} = {}) {
  return async function handleInteraction(context) {
    const { request, env } = context;
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const PUBLIC_KEY = env.DISCORD_PUBLIC_KEY || discordApplication.publicKey;
    const APP_ID = discordApplication.applicationId;

    if (!PUBLIC_KEY) return new Response('Missing config', { status: 500 });
    const sig = request.headers.get('x-signature-ed25519'), ts = request.headers.get('x-signature-timestamp');
    const bodyText = await readInteractionBody(request);
    if (bodyText === null) return new Response('Body too large', { status: 413 });

    if (!/^[0-9a-f]{128}$/i.test(sig || '') || !/^[0-9]{1,12}$/.test(ts || '')
      || Math.abs(Date.now() - Number(ts) * 1000) > 5 * 60 * 1000
      || !/^[0-9a-f]{64}$/i.test(PUBLIC_KEY) || !await verifyInteractionSignature(PUBLIC_KEY, sig, ts, bodyText)) {
      return new Response('Unauthorized', { status: 401 });
    }

    let interaction;
    try { interaction = JSON.parse(bodyText); } catch { return new Response('Invalid JSON', { status: 400 }); }
    if (!interaction || typeof interaction !== 'object') return new Response('Invalid interaction', { status: 400 });
    if (interaction.type === 1) return new Response(JSON.stringify({ type: 1 }), { headers: { 'Content-Type': 'application/json' } });

    if (interaction.application_id !== APP_ID) return new Response('Unauthorized', { status: 401 });
    if (isNewDiscordInteraction(interaction)) return handleDiscordBot(context, interaction, APP_ID);
    // Keep the existing v1 rollback behavior; v2 stale commands, components and
    // modals return private guidance before importing any legacy dependencies.
    if (env.DISCORD_BOT_VERSION === '2') return Response.json({ type: 4, data: { ...helpMessage(true), flags: 64 } });

    const { handleLegacyDiscordInteraction } = await loadLegacy();
    return handleLegacyDiscordInteraction(context, interaction, bodyText, APP_ID);
  };
}

export const onRequest = createDiscordInteractionHandler();
