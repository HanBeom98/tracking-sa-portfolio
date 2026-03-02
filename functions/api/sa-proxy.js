/**
 * Sudden Attack API Proxy (Cloudflare/Vercel Compatible)
 * Safely attaches the NEXON_API_KEY from environment variables.
 */
export async function onRequest(context) {
    const { request, env } = context;
    
    // CORS Preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, x-nxopen-api-key',
            }
        });
    }

    try {
        const url = new URL(request.url);
        // 클라이언트에서 보낸 타겟 URL (예: /open-api/v1/character/ouid?character_name=...)
        const targetPath = url.searchParams.get('path');
        
        if (!targetPath) {
            return new Response(JSON.stringify({ error: 'Missing path parameter' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        // 넥슨 API 기본 주소
        const NEXON_BASE_URL = 'https://open.api.nexon.com';
        const finalUrl = new URL(targetPath, NEXON_BASE_URL);
        
        // 원본 쿼리 스트링 복사 (path 외의 나머지 파라미터들)
        url.searchParams.forEach((value, key) => {
            if (key !== 'path') {
                finalUrl.searchParams.set(key, value);
            }
        });

        // 환경 변수에서 API 키 가져오기 (없으면 fallback으로 하드코딩된 값 사용 가능하나 권장하지 않음)
        const apiKey = env.NEXON_API_KEY || 'live_6e6f12fbfb54d0fad8b504b3303286fb1ce29b5a4e2f456d883cc44b2af445e6efe8d04e6d233bd35cf2fabdeb93fb0d';

        // 넥슨 API 호출
        const response = await fetch(finalUrl.toString(), {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'x-nxopen-api-key': apiKey
            }
        });

        const data = await response.json();

        return new Response(JSON.stringify(data), {
            status: response.status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'public, max-age=60' // 1분 캐싱으로 API 부하 감소
            }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
    }
}
