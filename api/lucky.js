// Vercel Bridge
import { onRequest } from '../functions/api/lucky.js';

export default async function handler(req, res) {
    const context = {
        request: {
            method: req.method,
            headers: new Headers(req.headers),
            json: async () => req.body
        },
        env: process.env
    };
    const response = await onRequest(context);
    const data = await response.json();
    res.status(response.status).json(data);
}