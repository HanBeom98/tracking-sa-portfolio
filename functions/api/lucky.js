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

    // Vercel 환경 변수(process.env)와 Cloudflare env 모두 대응
    const GEMINI_API_KEY = env?.GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : null);

    if (!GEMINI_API_KEY) {
        return addCORSHeaders(new Response(JSON.stringify({ error: 'Server configuration error: API key is not set.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        }));
    }

    try {
        const { language, currentDate, userInfo } = await request.json();
        const { name, gender, birthMonth, birthDay } = userInfo || {};

        const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

        const dateStr = `${currentDate.year}-${currentDate.month}-${currentDate.day}`;
        
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

        const geminiResponse = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    response_mime_type: "application/json",
                    temperature: 0.7
                }
            })
        });

        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.json();
            throw new Error(errorData.error?.message || 'Gemini API call failed');
        }

        const data = await geminiResponse.json();
        let text = data.candidates[0].content.parts[0].text;
        
        // JSON 추출 (마크다운 코드 블록 등 제거)
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