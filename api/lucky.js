// /api/lucky.js - Vercel 전용 핸들러
import { onRequest } from '../functions/api/lucky.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
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

        return res.status(response.status || 200).json(data);
    } catch (error) {
        console.error('Vercel Bridge API Error (Lucky):', error);
        return res.status(500).json({ error: error.message });
    }
}