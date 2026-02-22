// /api/lucky.js - Vercel Bridge Handler
import { onRequest } from '../functions/api/lucky.js';

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).end();
    }

    try {
        // Vercel에서 body는 이미 파싱되어 있을 수 있습니다.
        const body = req.body;

        const context = {
            request: {
                method: req.method,
                headers: req.headers,
                json: async () => body
            },
            env: process.env
        };

        const response = await onRequest(context);
        const data = await response.json();

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(response.status || 200).json(data);
    } catch (error) {
        console.error('Vercel Lucky Bridge Error:', error);
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(500).json({ error: error.message });
    }
}