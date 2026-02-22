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

    if (!env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY) {
        return addCORSHeaders(new Response(JSON.stringify({ error: 'Server configuration error: API key is not set.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        }));
    }

    if (request.method !== 'POST') {
        return addCORSHeaders(new Response('Method Not Allowed', { status: 405 }));
    }

    try {
        const { language, currentDate } = await request.json();

        const GEMINI_API_KEY = env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';

        let prompt = '';
        if (language === 'en') {
            prompt = `Today is ${currentDate.year}/${currentDate.month}/${currentDate.day}. 
            Based on this date, provide a "Lucky Color" and a "Lucky Item" for the day.
            Respond ONLY in JSON format with the following structure:
            {
                "colorName": "Color Name",
                "oklch": "oklch(L C H)",
                "colorDesc": "A short, positive description of why this color is lucky today.",
                "itemName": "Item Name",
                "itemIcon": "Emoji",
                "itemAction": "A short, positive action or tip related to this item."
            }
            Ensure the oklch value is valid and visually appealing. The description should be about 1-2 sentences.`;
        } else {
            prompt = `오늘은 ${currentDate.year}년 ${currentDate.month}월 ${currentDate.day}일입니다.
            이 날짜를 기반으로 오늘을 위한 "행운의 컬러"와 "행운의 아이템"을 추천해 주세요.
            반드시 아래 JSON 형식으로만 응답해 주세요:
            {
                "colorName": "색상 이름",
                "oklch": "oklch(L C H)",
                "colorDesc": "이 색상이 오늘 왜 행운을 주는지에 대한 짧고 긍정적인 설명.",
                "itemName": "아이템 이름",
                "itemIcon": "이모지",
                "itemAction": "이 아이템과 관련된 짧고 긍정적인 행동 팁이나 설명."
            }
            oklch 값은 실제 웹 CSS에서 사용할 수 있는 유효한 값이어야 합니다. 설명은 1~2문장으로 작성해 주세요.`;
        }

        const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    response_mime_type: "application/json"
                }
            })
        });

        const geminiData = await geminiResponse.json();

        if (geminiResponse.ok && geminiData.candidates && geminiData.candidates.length > 0) {
            const luckyData = JSON.parse(geminiData.candidates[0].content.parts[0].text);
            return addCORSHeaders(new Response(JSON.stringify(luckyData), {
                headers: { 'Content-Type': 'application/json' },
                status: 200
            }));
        } else {
            throw new Error(geminiData.error?.message || 'Failed to generate lucky data');
        }

    } catch (error) {
        return addCORSHeaders(new Response(JSON.stringify({ error: error.message }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500
        }));
    }
}