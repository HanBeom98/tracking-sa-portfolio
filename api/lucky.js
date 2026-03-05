// /api/lucky.js - Vercel Bridge Handler
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
        // 3. GEMINI_API_KEY 환경변수 확인
        if (!process.env.GEMINI_API_KEY) {
            console.error('CRITICAL: GEMINI_API_KEY is missing in Vercel environment.');
            return res.status(500).json({ error: 'Server configuration error: API key not set.' });
        }

        // 4. Cloudflare 형식의 context 구성
        const context = {
            request: {
                method: req.method,
                headers: req.headers,
                json: async () => req.body // Vercel에서 파싱된 body를 그대로 반환
            },
            env: process.env
        };

        // 5. 원본 함수 실행
        const response = await onRequest(context);
        
        // Response 객체의 본문 읽기
        const data = await response.json();

        // 6. 응답 상태 코드 및 데이터 반환
        return res.status(response.status || 200).json(data);
    } catch (error) {
        console.error('Vercel Lucky Bridge Error:', error);
        return res.status(500).json({ error: `Vercel Bridge Error: ${error.message}` });
    }
}