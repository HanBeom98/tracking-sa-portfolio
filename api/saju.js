// /api/saju.js (Vercel 루트의 브릿지 파일)
import { onRequest } from '../functions/api/saju.js';

export default async function handler(req, res) {
    // Vercel의 요청 객체를 Cloudflare가 이해하는 context 구조로 포장합니다.
    const context = {
        request: req,
        env: process.env // Vercel 대시보드에 설정한 환경변수를 주입합니다.
    };

    try {
        // 원본 함수를 호출하여 응답을 받습니다.
        const response = await onRequest(context);
        
        // 응답 본문을 읽어옵니다.
        const data = await response.json();
        
        // Vercel 형식으로 최종 응답을 보냅니다 (CORS 헤더 포함).
        return new Response(JSON.stringify(data), {
            status: response.status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: `Bridge Error: ${error.message}` }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}