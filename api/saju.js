// /api/saju.js - Vercel 전용 핸들러 (최종 수정본)
import { onRequest } from '../functions/api/saju.js';

export default async function handler(req, res) {
    // 1. CORS 헤더 직접 설정 (무한 로딩 방지)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 2. OPTIONS 요청 즉시 응답 (무한 로딩 해결 핵심)
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    try {
        // 3. Cloudflare 형식의 context 구성
        const context = {
            request: {
                method: req.method,
                headers: req.headers,
                json: async () => req.body // Vercel에서 파싱된 body를 그대로 반환
            },
            env: process.env
        };

        // 4. 원본 함수 실행
        const response = await onRequest(context);
        const data = await response.json();

        return res.status(response.status || 200).json(data);
    } catch (error) {
        console.error('Vercel Bridge API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}