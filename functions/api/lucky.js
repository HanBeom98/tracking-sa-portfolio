function addCORSHeaders(response) {
    response.headers.set('Access-Control-Allow-Origin', '*'); 
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    response.headers.set('Access-Control-Max-Age', '86400');
    return response;
}

export async function onRequest(context) {
    // fortune.js와 동일한 구조
    const { request, env } = context || {};

    if (request.method === 'OPTIONS') {
        return addCORSHeaders(new Response(null, { status: 204 }));
    }

    // GEMINI_API_KEY 확인
    const GEMINI_API_KEY = env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        console.error('CRITICAL: GEMINI_API_KEY not found.');
        return addCORSHeaders(new Response(JSON.stringify({ error: 'Server configuration error: API key is not set.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        }));
    }

    if (request.method !== 'POST') {
        return addCORSHeaders(new Response('Method Not Allowed', { status: 405 }));
    }

    try {
        const body = await request.json();
        const { language, currentDate, userInfo } = body;
        const { name, gender, birthMonth, birthDay } = userInfo || {};

        const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';

        const dateStr = currentDate ? `${currentDate.year}-${currentDate.month}-${currentDate.day}` : 'today';
        
        let prompt = '';
        if (language === 'en') {
            prompt = `Today is ${dateStr}. 
            User Info: Name: ${name || 'Anonymous'}, Gender: ${gender || 'Unknown'}, Birthday: ${birthMonth || '?'}/${birthDay || '?'}.
            Recommend a Lucky Color and a Lucky Item for today in JSON format only.
            JSON structure: {"colorName":"", "oklch":"", "colorDesc":"", "itemName":"", "itemIcon":"", "itemAction":""}`;
        } else {
            prompt = `오늘은 ${dateStr}입니다.
            사용자 정보: 이름: ${name || '익명'}, 성별: ${gender === 'male' ? '남성' : '여성'}, 생일: ${birthMonth || '?'}월 ${birthDay || '?'}일.
            이 정보를 바탕으로 오늘을 위한 "행운의 컬러"와 "행운의 아이템"을 추천해 주세요.
            반드시 아래 JSON 형식으로만 응답하세요:
            {"colorName":"색상명", "oklch":"oklch값", "colorDesc":"설명", "itemName":"아이템명", "itemIcon":"이모지", "itemAction":"행동팁"}`;
        }

        const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    response_mime_type: "application/json",
                    temperature: 0.7
                }
            })
        });

        const geminiData = await geminiResponse.json();

        if (!geminiResponse.ok) {
            throw new Error(geminiData.error?.message || 'Gemini API call failed');
        }

        let text = geminiData.candidates[0].content.parts[0].text;
        
        // JSON 파싱 (마크다운 방지)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Invalid AI response format');
        
        const luckyData = JSON.parse(jsonMatch[0]);

        return addCORSHeaders(new Response(JSON.stringify(luckyData), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        }));
    } catch (error) {
        console.error('Lucky API Core Error:', error);
        return addCORSHeaders(new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        }));
    }
}