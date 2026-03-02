// /api/sa-proxy.js - Vercel Bridge Handler
import { onRequest } from '../functions/api/sa-proxy.js';

export default async function handler(req, res) {
    // CORS Preflight
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-nxopen-api-key');
        return res.status(204).end();
    }

    try {
        const fullUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}${req.url}`;
        
        const context = {
            request: {
                method: req.method,
                headers: req.headers,
                url: fullUrl,
                json: async () => req.body
            },
            env: process.env
        };

        const response = await onRequest(context);
        const data = await response.json();

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=60');
        return res.status(response.status || 200).json(data);
    } catch (error) {
        console.error('Vercel SA-Proxy Bridge Error:', error);
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(500).json({ error: error.message });
    }
}
