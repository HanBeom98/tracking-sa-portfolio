// /api/fortune.js - Vercel Standalone Handler
export default async function handler(req, res) {
    // 1. CORS 및 기본 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');

    // 2. OPTIONS 요청(Preflight) 즉시 응답
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    // 3. POST 요청만 허용
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            console.error('CRITICAL: GEMINI_API_KEY is missing.');
            return res.status(500).json({ error: 'Server configuration error: API key not set.' });
        }

        const { name, birthDate, gender, language, currentDate } = req.body;

        if (!name || !birthDate || !gender || !currentDate) {
            return res.status(400).json({ error: '필수 정보가 누락되었습니다.' });
        }

        const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';

        let prompt = '';
        if (language === 'en') {
            prompt = `Today is ${currentDate.year}/${currentDate.month}/${currentDate.day}. Interpret fortune in English. Markdown format with subheadings: ### 🍀 Today's General Fortune, ### 💰 Wealth and Business, ### ✨ Lucky Item. User: ${name}, ${birthDate.year}/${birthDate.month}/${birthDate.day}, ${gender}.`;
        } else {
            prompt = `오늘은 ${currentDate.year}년 ${currentDate.month}월 ${currentDate.day}일입니다. 오늘의 운세를 상담가처럼 친절하고 희망적인 어조로 작성해 주세요. 마크다운 소제목 사용: ### 🍀 오늘의 총운, ### 💰 재물과 비즈니스, ### ✨ 행운의 아이템. 사용자: ${name}, ${birthDate.year}년 ${birthDate.month}월 ${birthDate.day}일, ${gender === 'male' ? '남성' : '여성'}.`;
        }

        const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const geminiData = await geminiResponse.json();

        if (geminiResponse.ok && geminiData.candidates && geminiData.candidates.length > 0) {
            const fortuneReading = geminiData.candidates[0].content.parts[0].text;
            return res.status(200).json({ sajuReading: fortuneReading });
        } else {
            const errorMessage = geminiData.error?.message || 'Gemini API 호출 실패';
            return res.status(geminiResponse.status || 500).json({ error: errorMessage });
        }

    } catch (error) {
        console.error('Vercel API Error:', error);
        return res.status(500).json({ error: `Internal Server Error: ${error.message}` });
    }
}
