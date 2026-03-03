// /functions/api/discord-sa.js - Secure Discord Webhook Proxy for SA
export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const webhookUrl = env.SA_DISCORD_WEBHOOK;
  if (!webhookUrl) {
    return new Response(JSON.stringify({ error: 'Webhook URL not configured' }), { status: 500 });
  }

  try {
    const body = await request.json();
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: 'Discord API error', details: errorText }), { status: response.status });
    }

    return new Response(JSON.stringify({ success: true }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
