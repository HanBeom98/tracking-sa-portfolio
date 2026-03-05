// /api/lucky.js - Vercel Standalone Debug Handler
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'Vercel Env Error: GEMINI_API_KEY is missing.' });
        }

        let data = req.body;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { /* skip */ }
        }

        const { language = 'ko', currentDate, userInfo } = data;
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

        // 구글 콘솔 리퍼러 제한 통과용 헤더 주입
        const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Referer': 'https://trackingsa.com/',
                'Origin': 'https://trackingsa.com'
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt + "\n\nIMPORTANT: Respond ONLY with a raw JSON object. Do not include markdown formatting or backticks. Valid JSON only." }] }]
            })
        });

        const geminiData = await geminiResponse.json();

        if (geminiResponse.ok) {
            return res.status(200).json(geminiData.candidates[0].content.parts[0].text);
        } else {
            return res.status(geminiResponse.status).json(geminiData);
        }
    } catch (error) {
        return res.status(500).json({ error: 'Vercel API Runtime Error (Lucky)', message: error.message });
    }
}
