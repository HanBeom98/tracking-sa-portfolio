// /api/discord-interaction.js - Vercel Bridge
import { onRequest } from '../functions/api/discord-interaction.js';

export default async function handler(req, res) {
  try {
    const context = {
      request: {
        method: req.method,
        headers: {
          get: (name) => req.headers[name.toLowerCase()],
          ...req.headers
        },
        text: async () => JSON.stringify(req.body),
        json: async () => req.body
      },
      env: process.env
    };

    const response = await onRequest(context);
    const data = await response.json();

    return res.status(response.status || 200).json(data);
  } catch (error) {
    console.error('Discord Interaction Bridge Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
