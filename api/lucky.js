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

        const { language = 'ko', currentDate, userInfo } = req.body;
        const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';
        
        const prompt = `Recommend Lucky Color and Item for ${userInfo?.name} on ${currentDate?.year}/${currentDate?.month}/${currentDate?.day}. Return JSON ONLY.`;

        const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const geminiData = await geminiResponse.json();

        if (geminiResponse.ok) {
            return res.status(200).json(geminiData.candidates[0].content.parts[0].text);
        } else {
            return res.status(500).json({ 
                error: 'Gemini API Error (Lucky)', 
                message: geminiData.error?.message || 'Unknown error',
                status: geminiResponse.status 
            });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Vercel Runtime Error (Lucky)', message: error.message });
    }
}
