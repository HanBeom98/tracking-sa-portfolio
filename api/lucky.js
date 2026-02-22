// /api/lucky.js - Vercel 전용 핸들러 (fortune.js와 완벽히 동일한 구조로 복구)
import { onRequest } from '../functions/api/lucky.js';

export default async function handler(req, res) {
    // 1. CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 2. OPTIONS 요청 즉시 응답
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    try {
        // 3. context 구성 (fortune.js와 동일하게 Headers 생성자 제거)
        const context = {
            request: {
                method: req.method,
                headers: req.headers,
                json: async () => req.body
            },
            env: process.env
        };

        // 4. 원본 함수 실행
        const response = await onRequest(context);
        const data = await response.json();

        return res.status(response.status || 200).json(data);
    } catch (error) {
        console.error('Vercel Lucky Bridge Error:', error);
        return res.status(500).json({ error: error.message });
    }
}