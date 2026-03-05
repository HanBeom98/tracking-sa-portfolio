function addCORSHeaders(response) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    response.headers.set('Access-Control-Max-Age', '86400');
    return response;
}

export async function onRequest(context) {
    const { request, env } = context || {};

    if (request.method === 'OPTIONS') {
        return addCORSHeaders(new Response(null, { status: 204 }));
    }

    if (!env.GEMINI_API_KEY) {
        return addCORSHeaders(new Response(JSON.stringify({ error: 'GEMINI_API_KEY is not set.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        }));
    }

    if (request.method !== 'POST') {
        return addCORSHeaders(new Response('Method Not Allowed', { status: 405 }));
    }

    try {
        const { language = 'ko', currentDate, userInfo } = await request.json();
        const GEMINI_API_KEY = env.GEMINI_API_KEY;
        const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';
        const dateStr = currentDate ? `${currentDate.year}-${currentDate.month}-${currentDate.day}` : new Date().toISOString().split('T')[0];
        
        const name = userInfo?.name || '익명';
        const gender = userInfo?.gender || 'unknown';
        const birthMonth = userInfo?.birthMonth || '1';
        const birthDay = userInfo?.birthDay || '1';

        let prompt = '';
        if (language === 'en') {
            prompt = `Today is ${dateStr}. 
            User: Name: ${name}, Gender: ${gender}, Birthday: ${birthMonth}/${birthDay}.
            Based on this info, provide a "Lucky Color" and "Lucky Item".
            Respond ONLY in JSON format.
            EVERY field value (colorName, colorDesc, itemName, itemAction) MUST be written in English.
            JSON structure: 
            {"colorName":"English Color Name", "oklch":"oklch(L C H)", "colorDesc":"English description", "itemName":"English Item Name", "itemIcon":"Emoji", "itemAction":"English Tip"}.
            IMPORTANT: The 'oklch' value MUST be a valid CSS string like 'oklch(0.7 0.1 200)'. No markdown.`;
        } else {
            prompt = `오늘은 ${dateStr}입니다.
            사용자: 이름: ${name}, 성별: ${gender === 'male' ? '남성' : '여성'}, 생일: ${birthMonth}월 ${birthDay}일.
            이 정보를 바탕으로 오늘을 위한 "행운의 컬러"와 "행운의 아이템"을 추천해 주세요.
            반드시 아래 JSON 형식으로만 응답하세요:
            {"colorName":"한글 컬러명", "oklch":"oklch(L C H)", "colorDesc":"설명", "itemName":"한글 아이템명", "itemIcon":"이모지", "itemAction":"행동팁"}
            중요: 'oklch' 값은 반드시 브라우저 CSS에서 즉시 사용 가능한 'oklch(0.7 0.1 200)' 형식의 순수 문자열이어야 합니다. 모든 필드는 반드시 한국어로 작성하세요.`;
        }

        const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Referer': 'https://trackingsa.com'
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt + "\n\nIMPORTANT: Respond ONLY with a raw JSON object. Do not include markdown formatting or backticks. Valid JSON only." }] }]
            })
        });

        const geminiData = await geminiResponse.json();

        if (geminiResponse.ok && geminiData.candidates) {
            return addCORSHeaders(new Response(JSON.stringify(geminiData.candidates[0].content.parts[0].text), {
                headers: { 'Content-Type': 'application/json' },
                status: 200
            }));
        } else {
            return addCORSHeaders(new Response(JSON.stringify({ error: 'Failed to generate lucky recommendation' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 500
            }));
        }
    } catch (error) {
        return addCORSHeaders(new Response(JSON.stringify({ error: error.message }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
        }));
    }
}
