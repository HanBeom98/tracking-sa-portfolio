// /api/fortune.js - Vercel Standalone Debug Handler
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

        const { name, birthDate, gender, language, currentDate } = req.body;
        const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';

        const prompt = language === 'en' 
            ? `Fortune for ${name}, ${gender}, ${currentDate.year}/${currentDate.month}/${currentDate.day}. Markdown format.`
            : `오늘 날짜 ${currentDate.year}/${currentDate.month}/${currentDate.day}, 사용자 ${name}(${gender})의 운세를 마크다운으로 작성해줘.`;

        const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const geminiData = await geminiResponse.json();

        if (geminiResponse.ok) {
            const fortuneReading = geminiData.candidates[0].content.parts[0].text;
            return res.status(200).json({ sajuReading: fortuneReading });
        } else {
            // Gemini가 403을 뱉으면 여기서 구체적인 이유를 포함해 500으로 전달 (Vercel 403과 구분하기 위함)
            console.error('Gemini API Error:', geminiData.error);
            return res.status(500).json({ 
                error: 'Gemini API Error', 
                message: geminiData.error?.message || 'Unknown error',
                status: geminiResponse.status 
            });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Vercel Runtime Error', message: error.message });
    }
}
