// /api/discord-sa.js - Vercel Bridge for SA Discord Webhook
import { onRequest } from '../functions/api/discord-sa.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  try {
    const context = {
      request: {
        method: req.method,
        headers: req.headers,
        json: async () => req.body
      },
      env: process.env
    };

    const response = await onRequest(context);
    const data = await response.json();

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(response.status || 200).json(data);
  } catch (error) {
    console.error('Discord Proxy Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
