// /functions/api/discord-sa.js - Secure Discord Webhook Proxy for SA
import { requireStaffToken } from '../security/firebase-id-token.js';

const ALLOWED_ORIGIN = 'https://trackingsa.com';
const MAX_REQUEST_BYTES = 12_000;

function sanitizeWebhookPayload(body) {
  if (!body || !Array.isArray(body.embeds) || body.embeds.length < 1 || body.embeds.length > 3) {
    throw new Error('Invalid Discord payload');
  }

  const embeds = body.embeds.map((embed) => ({
    title: String(embed?.title || '').slice(0, 256),
    description: String(embed?.description || '').slice(0, 4096),
    color: Number.isInteger(embed?.color) ? embed.color : 0x0052cc,
    fields: Array.isArray(embed?.fields)
      ? embed.fields.slice(0, 25).map((field) => ({
          name: String(field?.name || '').slice(0, 256),
          value: String(field?.value || '').slice(0, 1024),
          inline: Boolean(field?.inline),
        }))
      : [],
    timestamp: new Date().toISOString(),
    footer: { text: 'Tracking SA Match Analytics' },
  }));

  return { embeds, allowed_mentions: { parse: [] } };
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    await requireStaffToken(request);
    const webhookUrl = env.SA_DISCORD_WEBHOOK;
    if (!webhookUrl) {
      return new Response(JSON.stringify({ error: 'Webhook is unavailable' }), { status: 503 });
    }
    const body = await request.json();
    const serializedBody = JSON.stringify(body);
    if (serializedBody.length > MAX_REQUEST_BYTES) {
      return new Response(JSON.stringify({ error: 'Payload too large' }), { status: 413 });
    }
    const payload = sanitizeWebhookPayload(body);
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: 'Discord API error', details: errorText }), { status: response.status });
    }

    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN }
    });
  } catch (error) {
    const unauthorized = /authorization|Firebase ID token|Firebase token|signing key/i.test(error.message);
    return new Response(JSON.stringify({ error: unauthorized ? 'Unauthorized' : 'Invalid request' }), {
      status: unauthorized ? 401 : 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN }
    });
  }
}
