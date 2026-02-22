function addCORSHeaders(response) {
    response.headers.set('Access-Control-Allow-Origin', '*'); 
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return response;
}

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method === 'OPTIONS') {
        return addCORSHeaders(new Response(null, { status: 204 }));
    }

    // 오늘의 운세(fortune.js)와 동일한 키 획득 방식
    const GEMINI_API_KEY = env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
        return addCORSHeaders(new Response(JSON.stringify({ error: 'API 키가 설정되지 않았습니다.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        }));
    }

    try {
        const { language, currentDate, userInfo } = await request.json();
        const { name, gender, birthMonth, birthDay } = userInfo || {};

        const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

        let prompt = '';
        if (language === 'en') {
            prompt = `Today is ${currentDate.year}/${currentDate.month}/${currentDate.day}. 
            User: Name: ${name || 'Anonymous'}, Gender: ${gender || 'Unknown'}, Birthday: ${birthMonth || '?'}/${birthDay || '?'}.
            Provide personalized "Lucky Color" and "Lucky Item" in JSON format: {"colorName":"", "oklch":"", "colorDesc":"", "itemName":"", "itemIcon":"", "itemAction":""}`;
        } else {
            prompt = `오늘은 ${currentDate.year}년 ${currentDate.month}월 ${currentDate.day}일입니다.
            사용자: 이름: ${name || '익명'}, 성별: ${gender === 'male' ? '남성' : '여성'}, 생일: ${birthMonth || '?'}월 ${birthDay || '?'}일.
            이 정보를 바탕으로 오늘을 위한 "행운의 컬러"와 "행운의 아이템"을 추천해 주세요.
            반드시 아래 JSON 형식으로만 응답하세요: {"colorName":"색상명", "oklch":"oklch값", "colorDesc":"설명", "itemName":"아이템명", "itemIcon":"이모지", "itemAction":"행동팁"}`;
        }

        const geminiResponse = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json" }
            })
        });

        const data = await geminiResponse.json();
        const luckyData = JSON.parse(data.candidates[0].content.parts[0].text);

        return addCORSHeaders(new Response(JSON.stringify(luckyData), {
            headers: { 'Content-Type': 'application/json' },
            status: 200
        }));
    } catch (error) {
        return addCORSHeaders(new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        }));
    }
}