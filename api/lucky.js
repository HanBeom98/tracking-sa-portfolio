// /api/lucky.js - Vercel Bridge Handler
import { onRequest } from '../functions/api/lucky.js';

export default async function handler(req, res) {
    // OPTIONS 요청 처리 (CORS)
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
                headers: new Headers(req.headers),
                json: async () => req.body
            },
            env: process.env // Vercel의 환경 변수를 env 객체로 전달
        };

        const response = await onRequest(context);
        const data = await response.json();

        // 응답 헤더 설정
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        
        return res.status(response.status || 200).json(data);
    } catch (error) {
        console.error('Vercel Lucky Bridge Error:', error);
        return res.status(500).json({ error: error.message });
    }
}