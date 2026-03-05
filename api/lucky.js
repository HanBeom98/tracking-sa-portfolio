// /api/lucky.js - Vercel Standalone Handler
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'API key is not set.' });
        }

        const { language = 'ko', currentDate, userInfo } = req.body;
        const name = userInfo?.name || '익명';
        const gender = userInfo?.gender || 'unknown';
        const birthMonth = userInfo?.birthMonth || '1';
        const birthDay = userInfo?.birthDay || '1';

        const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';
        const dateStr = currentDate ? `${currentDate.year}-${currentDate.month}-${currentDate.day}` : new Date().toISOString().split('T')[0];
        
        let prompt = '';
        if (language === 'en') {
            prompt = `Today is ${dateStr}. User: ${name}, ${gender}, ${birthMonth}/${birthDay}. Recommend "Lucky Color" and "Lucky Item". Respond ONLY with a raw JSON object: {"colorName":"Name", "oklch":"oklch(L C H)", "colorDesc":"Desc", "itemName":"Name", "itemIcon":"Emoji", "itemAction":"Tip"}. IMPORTANT: oklch value MUST be a valid CSS string like 'oklch(0.7 0.1 200)'.`;
        } else {
            prompt = `오늘은 ${dateStr}입니다. 사용자: ${name}, ${gender === 'male' ? '남성' : '여성'}, 생일: ${birthMonth}월 ${birthDay}일. 행운의 컬러와 아이템을 추천해 주세요. 반드시 JSON 형식으로만 응답하세요: {"colorName":"한글명", "oklch":"oklch(L C H)", "colorDesc":"설명", "itemName":"아이템명", "itemIcon":"이모지", "itemAction":"행동팁"}. 중요: oklch는 반드시 'oklch(0.7 0.1 200)' 형식의 유효한 CSS 문자열이어야 합니다.`;
        }

        const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const geminiData = await geminiResponse.json();
        if (!geminiResponse.ok) throw new Error(geminiData.error?.message || 'Gemini API Error');

        let text = geminiData.candidates[0].content.parts[0].text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Invalid AI response');
        
        return res.status(200).json(JSON.parse(jsonMatch[0]));
    } catch (error) {
        console.error('Lucky API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
