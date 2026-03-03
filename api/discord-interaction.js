// /api/discord-interaction.js - Vercel Bridge with Raw Body Support
import { onRequest } from '../functions/api/discord-interaction.js';

export const config = {
  api: {
    bodyParser: false, // 디스코드 서명 검증을 위해 자동 파싱을 끕니다.
  },
};

async function getRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  try {
    const rawBody = await getRawBody(req);
    const bodyText = rawBody.toString('utf-8');

    const context = {
      request: {
        method: req.method,
        headers: {
          get: (name) => req.headers[name.toLowerCase()],
          ...req.headers
        },
        text: async () => bodyText,
        json: async () => JSON.parse(bodyText)
      },
      env: process.env
    };

    const response = await onRequest(context);
    const data = await response.json();

    res.setHeader('Content-Type', 'application/json');
    return res.status(response.status || 200).json(data);
  } catch (error) {
    console.error('Discord Interaction Bridge Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
